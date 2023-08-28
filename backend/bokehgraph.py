from bokeh.layouts import Column, gridplot, row, grid, layout
from functools import partial
from bokeh.plotting import figure, output_file, show, ColumnDataSource,curdoc
from bokeh.models import HoverTool,CDSView, GroupFilter, NumericInput, Button, Label, OpenURL, CustomJS
from bokeh.palettes import RdYlBu11 as palette
from bokeh.server.server import Server
from bokeh.application import Application
from bokeh.application.handlers.function import FunctionHandler
from bokeh.models.widgets import Button, Div, PreText
import queries
import telegramBot
from bokeh.resources  import settings
from bokeh.client import push_session
import bokeh.io
import pandas as pd
import scrapOnDemand

settings.resources = 'inline'

#ADD URL TO BETFAIR MARKET FOR QUICK BETS
#ADD REFRESH BUTTON


#DELETE GRAPHS WHEN OTHER MARKETS ARE DONE


def getRelatedSelections(eventID,selectionID = None, oldEvents ="No", marketid = None):
    query = "SELECT tbf.MarketID, tbf.SelectionID, tbf.MarketName, tbf.SelectionName, tbf.Home, tbf.Away, tbf.LastTradedPrice, tbf.Sport  FROM tblBetfairSelections AS tbf WHERE EXISTS ( SELECT EventID FROM tblBFGraph_Data WHERE EventID = tbf.EventID AND MarketID = tbf.MarketID AND SelectionID = tbf.SelectionID ) AND  tbf.EventID = ? AND tbf.Status ='ACTIVE'"
    if selectionID:
        query = query + " AND tbf.SelectionID = '" + str(selectionID) + "'"
    if marketid:
        query = query + " AND tbf.marketid = '" + str(marketid) + "'"

    if oldEvents == "No":
        query = query + " AND (tbf.LastUpdate > DATEADD(mi, - 5, GETDATE() ))"
    query = query + " ORDER BY CASE WHEN tbf.MarketName = 'Match Odds' THEN 1  WHEN  tbf.MarketName = 'Half Time' THEN 2  ELSE 10 END,  tbf.LastTradedPrice"    
    results = queries.getData(query,eventID)        
    return results

def getTransactions(eventID,lastXminutes = 0, oldEvents ="No", directfeed="no"):
    if directfeed == "yes":
        return
    query = "SELECT * FROM tblBFGraph_Data WHERE EventID = ?  " 
    if oldEvents == "No":
        query = query + " AND (LastUpdate > DATEADD(mi, - 5, GETDATE() ))"
    if lastXminutes != None:
        if lastXminutes > 0:        
            query = query + " AND (VolumeDate > DATEADD(mi,-" + str(lastXminutes) + ", (SELECT MAX(VolumeDate) FROM tblBFGraph_Data WHERE EventID =" +str(eventID) + "))) "
    #ORDER BY
    query = query + ' ORDER BY EventID, MarketID, SelectionID, VolumeDate'
    
   
    if directfeed=="no":
        df_transactions = queries.getData(query,eventID,False,True)  
        df_transactions['SelectionID'] = df_transactions['SelectionID'].astype(str)
    else:
        selections = getRelatedSelections(eventID)
        df_transactions = pd.DataFrame()
        for selection in selections:
            resultsDF = pd.DataFrame()
            resultsDF = scrapOnDemand.selectionToScan(selection[0],selection[1],eventID,True)
            df_transactions = df_transactions.append(resultsDF,ignore_index=True)

    
    return df_transactions

def getMatchInfo(eventID,oldEvent):
    if oldEvent == "No":
        query ="SELECT * FROM viewEvents WHERE EventID = ?"
        data = queries.getData(query,eventID,True)     
        if data == None: return "NO DATA"
        timer = data[4]
        if timer: 
            timer = str(timer) + "'"
        else:
            timer = ""

        text =data[6] + " vs " + data[7] + " ------ Score: "+ str(data[8]) + " : " + str(data[9]) +" ------ MatchPeriod: " + data[3] + " " + str(timer)
    else:
        text = "RECORDED MATCH"
    return text

def updateDatasource():    
    bf_datasource.data = getTransactions(eventID,lastXminINPUT.value, oldEvent,directfeed)    
    matchInfoDiv.text=getMatchInfo(eventID,oldEvent)
    return

def buttonCallBack(order, selectionID, marketID, sport):        
    data = getRelatedSelections(eventID,selectionID, marketid=marketID)

    if "BACK H" in order:        
        btnMessage ="BACK " + str(data[0][4]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "BACK A" in order:        
        btnMessage ="BACK " + str(data[0][5]) + " " + str(data[0][2]) + " at " + str(data[0][6])
    elif "BACK D" in order:        
        btnMessage ="BACK DRAW " + str(data[0][2]) + " at " + str(data[0][6])

    if "LAY H" in order:        
        btnMessage ="LAY " + str(data[0][4]) + " " + str(data[0][2]) +  " at " + str(data[0][6])
    elif "LAY A" in order:        
        btnMessage ="BACK " + str(data[0][5]) + " " + str(data[0][2]) +  " at " + str(data[0][6])
    elif "LAY D" in order:        
        btnMessage ="LAY DRAW " + str(data[0][2]) + " at " + str(data[0][6])
        
    url = f"http://161.97.91.91:5006/bokehgraph?evID={ str(eventID)}"
    
    if sport == "Football":
        CHAT_ID = -869164788
    elif sport == "Tennis":
        CHAT_ID = -834172918
    else:
        CHAT_ID = 1150468112

    print("ALERT SENT",order,selectionID,marketID,sport)

    telegramBot.sendNotification("Trade Alert " + btnMessage,url, CHAT_ID)
    
    
    return

def deleteCallBack(order, selectionID):        
    #SOLUTION TO REMOVE THE COLUMN/LAYOUT 
    print("REMOVE",order)
    model = curdoc().get_model_by_name(order)           
    curdoc().remove_root(model)    
    bokeh.io.show
    return


    


    

def renderGraphs(datasource,selectionID, selectionName, marketID, marketName, sport, homename, awayname):
    if selectionName == "Away": 
        selectionLabel = awayname
    elif  selectionName == "Home": 
        selectionLabel = homename
    else:
        selectionLabel = "Draw"
    
    selectionView = CDSView(source=datasource,filters=[GroupFilter(column_name='SelectionID', group=str(selectionID)), GroupFilter(column_name='MarketID', group=str(marketID))])
    
    #PRICE CHART
    g = figure(width=600,height = 200,  title = "Price For: " + selectionLabel  + " " + marketName)
    #g.sizing_mode ="scale_both"
    #SET HOVER FOR PRICE CHART
    my_hover=HoverTool()
    my_hover.tooltips=[('Price','@Price{0.00}'), ('Volume', '@Volume{0.00 a}'),('VolumeDate','@VolumeDate{%Y-%m-%d %H:%M:%S}')]
    my_hover.formatters={'@VolumeDate':'datetime'}
    g.add_tools(my_hover)
    g.step('index','Price',color='red',alpha=0.5, source=datasource, view= selectionView)
    #g.step('index','Price',color='red',alpha=0.5, source=datasource)

    #VOLUME CHART
    w = 1    
    v = figure(width=600,height = 200,  title = "Volume For: " + selectionLabel + " " + marketName, x_range = g.x_range, x_axis_label = None)
    #v.sizing_mode ="scale_both"
    #SET HOVER FOR VOLUME CHART
    my_hover=HoverTool()
    my_hover.tooltips=[('Price','@Price{0.00}'), ('Volume', '@Volume{0.00 a}'),('VolumeDate','@VolumeDate{%Y-%m-%d %H:%M:%S}')]
    my_hover.formatters={'@VolumeDate':'datetime'}
    v.add_tools(my_hover)
    v.vbar('index',w,'Volume',source=datasource,  view= selectionView)    
    #v.vbar('index',w,'Volume',source=datasource)   
    
    #LAY BUTTON
    btnLabel = "LAY " + str(selectionName) + " " + str(marketName)
    buttonLay = Button(label = btnLabel, name = btnLabel, background="#FFC0CB")
    buttonLay.on_click(partial(buttonCallBack, order=btnLabel, selectionID=selectionID,sport=sport,marketID=marketID))  

    #BACK BUTTON
    btnLabel = "BACK " + str(selectionName) + " " + str(marketName)  
    buttonBack = Button(label = btnLabel, name = btnLabel, button_type='primary')
    buttonBack.on_click(partial(buttonCallBack, order=btnLabel, selectionID=selectionID, sport=sport,marketID=marketID))  

    #BACK BUTTON
    btnLabel = "To Betfair"
    
    link = f"https://www.betfair.com/exchange/plus/{sport[0].lower() + sport[1:]}/market/{str(marketID)}"
    buttonLink = Button(label = btnLabel, button_type='success')
    buttonLink.js_on_click(CustomJS(args=dict(urls=[link]),code="urls.forEach(url => window.open(url))"))

    #buttonColumn = Column(buttonLay,buttonBack,sizing_mode="scale_both")

    #DELETE BUTTON
    #btnLabel = "Remove " + str(selectionName) + " " + str(marketName)  
    #buttonRemove = Button(label = btnLabel, name = btnLabel, button_type='danger')
    #buttonRemove.on_click(partial(deleteCallBack, order=str(selectionName) + " " + str(marketName), selectionID=selectionID))  
       

    #WITH DELETE BUTTON
    #column = Column(buttonLay,buttonBack, buttonRemove,g,v,sizing_mode="scale_both",name =selectionName + " " + marketName)
    column = Column(buttonLay,buttonBack, buttonLink, g,v,sizing_mode="scale_both",name =selectionName + " " + marketName)

    return column

#-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
#-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


#We can request all graphs that belong to an EVENT.
#We can request CUSTOM selections

arguments = curdoc().session_context.request.arguments
#graphType = str(arguments.get('graphType')[0],'utf-8')
eventID = str(arguments.get('evID')[0],'utf-8')
oldEvent = "No"
directfeed="no"

try:
    oldEvent = str(arguments.get('oldEvent')[0],'utf-8')
except:
    pass

try:
    directfeed = str(arguments.get('df')[0],'utf-8')
except:
    pass


#SET DATASOURCE FOR ALL
bf_datasource = ColumnDataSource(getTransactions(eventID,oldEvents=oldEvent,directfeed=directfeed))    

#FOR EACH SELECTION, MAKE A GRAPH
selections = getRelatedSelections(eventID, oldEvents= oldEvent)
if selections:
    title = str(selections[0][4]) + ' vs ' + str(selections[0][5])
    curdoc().title = title

    listofGraphs = []
    for selection in selections:
        graphs = renderGraphs(bf_datasource,selection[1],selection[3], selection[0], selection[2], selection[7], selection[4],selection[5])
        listofGraphs.append(graphs)


    #r = row(children = listofGraphs, sizing_mode = 'stretch_both')
    r = gridplot(children=listofGraphs,ncols=3,sizing_mode='stretch_both')


    matchInfoDiv = PreText(text = getMatchInfo(eventID,oldEvent))
    lastXminINPUT = NumericInput(value=0,title="Last X Minutes")
#refreshBtn = Button(label="Refresh", button_type ="success", name="refreshbtn")
#refreshBtn.on_click(updateDatasource) 



#div = Div(text='<div height="120px" width="700px" overflow="hidden" float="left" overflow="auto"> <iframe height="200px" width="100%" border="none" src="https://www.sofascore.com/event/10388461/attack-momentum/embed"></iframe></div>')
#curdoc().add_root(div)
    r_ow = row(lastXminINPUT)
    l = layout(children=[matchInfoDiv,r_ow,r])
    #curdoc().add_root(matchInfoDiv)
    #curdoc().add_root(r_ow)
    curdoc().add_root(l)   
    curdoc().add_periodic_callback(updateDatasource, 5000)
else:
    matchInfoDiv = PreText(text = "NO DATA, RELOAD OR CONFIRM")
    curdoc().add_root(matchInfoDiv)


#SPINNER EXAMPLE
#https://discourse.bokeh.org/t/small-example-on-a-loading-div/9058/5

