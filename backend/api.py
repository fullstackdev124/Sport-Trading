import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import queries
import pandas as pd
import telegramBot
from datetime import datetime

app = Flask(__name__)
CORS(app)

def getMatchInfo(eventID, oldEvent):
    if oldEvent == "No":
        query ="SELECT * FROM viewEvents WHERE EventID = ?"
        data = queries.getData(query,eventID,True)
        if data == None: return "NO DATA"
        timer = data[4]
        if timer:
            timer = str(timer) + "'"
        else:
            timer = ""

        text = data[6] + " vs " + data[7] + " ------ Score: "+ str(data[8]) + " : " + str(data[9]) +" ------ MatchPeriod: " + data[3] + " " + str(timer)
    else:
        text = "RECORDED MATCH"
    return text

def getRelatedSelections(eventID, selectionID=None, oldEvents="No", marketID=None):
    query = "SELECT tbf.MarketID, tbf.SelectionID, tbf.MarketName, tbf.SelectionName, tbf.Home, tbf.Away, tbf.LastTradedPrice, tbf.Sport FROM tblBetfairSelections AS tbf WHERE EXISTS ( SELECT EventID FROM tblBFGraph_Data WHERE EventID = tbf.EventID AND MarketID = tbf.MarketID AND SelectionID = tbf.SelectionID ) AND  tbf.EventID = ? AND tbf.Status ='ACTIVE'"
    if selectionID is not None:
        query = query + " AND tbf.SelectionID = '" + str(selectionID) + "'"
    if marketID is not None:
        query = query + " AND tbf.marketID = '" + str(marketID) + "'"

    if oldEvents == "No":
        query = query + " AND (tbf.LastUpdate > DATEADD(mi, - 5, GETDATE() ))"
    query = query + " ORDER BY CASE WHEN tbf.MarketName = 'Match Odds' THEN 1  WHEN  tbf.MarketName = 'Half Time' THEN 2 WHEN tbf.MarketName = 'Set 1 Winner' THEN 3  ELSE 10 END,  tbf.LastTradedPrice"
    results = queries.getData(query, eventID)
    return results

def getRacingRecords(eventID, selectionID=None, oldEvents="No", marketID=None):
    query = "SELECT tbf.MarketID, tbf.SelectionID, tbf.MarketName, tbf.SelectionName, tbf.Home, tbf.Away, tbf.LastTradedPrice, tbf.Sport, tbf.MarketStartTime  FROM tblBetfairSelections AS tbf WHERE EXISTS ( SELECT EventID FROM tblBFGraph_Data WHERE EventID = tbf.EventID AND MarketID = tbf.MarketID AND SelectionID = tbf.SelectionID ) AND  tbf.EventID = ? AND tbf.Status ='ACTIVE'"
    if selectionID is not None:
        query = query + " AND tbf.SelectionID = '" + str(selectionID) + "'"
    if marketID is not None:
        query = query + " AND tbf.marketID = '" + str(marketID) + "'"

    if oldEvents == "No":
        query = query + " AND (tbf.LastUpdate > DATEADD(mi, - 5, GETDATE() ))"
    query = query + " ORDER BY CASE WHEN tbf.MarketName = 'Match Odds' THEN 1  WHEN  tbf.MarketName = 'Half Time' THEN 2 WHEN tbf.MarketName = 'Set 1 Winner' THEN 3  ELSE 10 END,  tbf.LastTradedPrice"
    results = queries.getData(query, eventID)
    return results


def getTransactions(eventID, lastXminutes=0, oldEvents="No", directfeed="no", selectionID=None, marketID=None):
    if directfeed == "yes":
        return

    query = "SELECT * FROM tblBFGraph_Data WHERE EventID = ?  "
    if oldEvents == "No":
        query = query + " AND (LastUpdate > DATEADD(mi, - 5, GETDATE() ))"
    if selectionID is not None:
        query = query + " AND SelectionID='" + str(selectionID) + "' "
    if marketID is not None:
        query = query + " AND MarketID='" + str(marketID) + "' "
    if lastXminutes != None:
        if lastXminutes > 0:
            query = query + " AND (VolumeDate > DATEADD(mi,-" + str(
                lastXminutes) + ", (SELECT MAX(VolumeDate) FROM tblBFGraph_Data WHERE EventID =" + str(eventID) + "))) "
    # ORDER BY
    query = query + ' ORDER BY EventID, MarketID, SelectionID, VolumeDate'

    

    if directfeed == "no":
        df_transactions = queries.getData(query, eventID, False, True)
        df_transactions['SelectionID'] = df_transactions['SelectionID'].astype(str)
    else:
        selections = getRelatedSelections(eventID)
        df_transactions = pd.DataFrame()
        for selection in selections:
            resultsDF = pd.DataFrame()
            # resultsDF = scrapOnDemand.selectionToScan(selection[0],selection[1],eventID,True)
            df_transactions = df_transactions.append(resultsDF, ignore_index=True)

    return df_transactions


@app.route('/')
def index():
    return "BokehGraph Rest API Server"

@app.route('/api/match', methods=['GET'])
def apiMatch():
    body = request.args

    eventID = body.get('evID')
    oldEvent = "No" if body.get('oldEvent') is None else body.get('oldEvent')
    racing = "No" if body.get('racing') is None else body.get('racing')	
    marketID = body.get("marketID")

    if racing == "No": 
        return getMatchInfo(eventID, oldEvent)	
    else:
        response = getRacingRecords(eventID, oldEvents=oldEvent, marketID=marketID)
        print(response)
        if response is not None:
            for row in response:
                result = row

        if result is not None:
            return result[4] + " " + result[5] + " " + result[8].strftime("%H:%M")
        
    return "RACING"

@app.route('/api/transactions', methods=['GET'])
def apiTransactions():
    body = request.args

    eventID = body.get('evID')
    oldEvent = "No" if body.get('oldEvent') is None else body.get('oldEvent')
    lastXminutes = 0 if body.get('lastXminutes') is None else int(body.get('lastXminutes'))
    directfeed = "no" if body.get('df') is None else body.get('df')
    marketID = body.get("marketID")
    selectionID = body.get("selectionID")

    response = getTransactions(eventID, lastXminutes=lastXminutes, oldEvents=oldEvent, directfeed=directfeed, selectionID=selectionID, marketID=marketID)
    return response.to_json()

@app.route('/api/data', methods=['GET'])
def apiData():
    body = request.args

    eventID = body.get('evID')
    oldEvent = "No" if body.get('oldEvent') is None else body.get('oldEvent')
    marketID = body.get("marketID")
    selectionID = body.get("selectionID")

    response = getRelatedSelections(eventID, oldEvents=oldEvent, marketID=marketID, selectionID=selectionID)
    results = []
    if response is not None:
        for row in response:
            results.append(tuple(row))

    return json.dumps(results)

@app.route('/api/notify', methods=['GET'])
def apiNotify():
    body = request.args

    eventID = body.get('evID')
    order = body.get('order')
    selectionID = body.get('selectionID')
    marketID = body.get('marketID')
    sport = body.get('sport')
    priceImage = body.get('priceImage')
    volumeImage = body.get('volumeImage')

    
    data = getRelatedSelections(eventID, selectionID, marketID=marketID)

    if "BACK H" in order:
        btnMessage = "BACK " + str(data[0][4]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "BACK A" in order:
        btnMessage = "BACK " + str(data[0][5]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "BACK D" in order:
        btnMessage = "BACK DRAW " + str(data[0][2]) + " at " + str(data[0][6])

    if "LAY H" in order:
        btnMessage = "LAY " + str(data[0][4]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "LAY A" in order:
        btnMessage = "BACK " + str(data[0][5]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "LAY D" in order:
        btnMessage = "LAY DRAW " + str(data[0][2]) + " at " + str(data[0][6])

    url = "http://194.163.143.51:88/?evID="+str(eventID)

    if 'racing' in sport:
        if 'BACK' in order: 
            order = 'BACK'
        else:
            order = "LAY"
        btnMessage = order + " " + str(data[0][3]) + " at " + str(data[0][4])
        url = "http://194.163.143.51:88/?evID="+str(eventID)+"&racing=yes&marketID="+str(marketID)

    if sport == "Football":
        CHAT_ID = -869164788
    elif sport == "Tennis":
        CHAT_ID = -834172918
    elif 'racing' in sport:
        CHAT_ID = -860049929
    else:
        CHAT_ID = 1150468112

#    print("ALERT SENT", url, order, selectionID, marketID, sport)

    telegramBot.sendNotification("Trade Alert " + btnMessage, url, CHAT_ID)

    return "success"


@app.route('/api/screenshot', methods=['GET'])
def apiScreenshot():
    body = request.args

    eventID = body.get('evID')
    image = body.get('image')

    url = "http://194.163.143.51:88?evID=" + str(eventID)

    CHAT_ID = -869164788

    #    print("ALERT SENT", url, order, selectionID, marketID, sport)

    if (image is not None):
        telegramBot.sendNotification("Screenshot: " + image, url, CHAT_ID)

    return "success"



app.run(host='0.0.0.0', port=5001)
