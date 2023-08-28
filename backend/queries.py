import pyodbc
import pandas as pd
import os
from configuration import DB_DRIVER,DB_SERVER,DB_DATABASE,DB_USERNAME,DB_PASS,LOCAL_SYSTEM, PRINT_SUCCESS
import time

def UpdateDatabase(process,query,params = None):
    if LOCAL_SYSTEM:
        #MS ACCESS CURSOR AND QUERY
        conn = pyodbc.connect(r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ='+os.path.dirname(os.path.abspath(__file__))+'\db_BetScanner.accdb;')
        
    else:
        conn = pyodbc.connect('DRIVER={'+DB_DRIVER+'};SERVER='+DB_SERVER+';DATABASE='+DB_DATABASE+';UID='+DB_USERNAME+';PWD='+ DB_PASS+';TrustServerCertificate=yes;')

    cursor = conn.cursor()

    try:       
        if params == None:           
            cursor.execute(query)
        else:
            cursor.execute(query,params)
        
        conn.commit()
        cursor.close()
        conn.close()
        if PRINT_SUCCESS: print("Success:",process, params)
        #if LOCAL_SYSTEM: time.sleep(1)
        return True
    except pyodbc.Error as ex:
        sqlstate = ex.args[1]
        print("ERROR:",process,params,sqlstate)   
        pass
        return False

def getData(query,params = None, oneRow = False, asDataFrame= False):
    try:    
        if LOCAL_SYSTEM:
            #MS ACCESS CURSOR AND QUERY
            conn = pyodbc.connect(r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ='+os.path.dirname(os.path.abspath(__file__))+'\db_BetScanner.accdb;')           
        else:
            conn = pyodbc.connect('DRIVER={'+DB_DRIVER+'};SERVER='+DB_SERVER+';DATABASE='+DB_DATABASE+';UID='+DB_USERNAME+';PWD='+ DB_PASS+';TrustServerCertificate=yes;')

        cursor = conn.cursor()

        if params == None:
            cursor.execute(query)
        else:
            cursor.execute(query,params)        

        if oneRow:  
            results = cursor.fetchone()            
            if asDataFrame:
                columns = [column[0] for column in cursor.description]
                df = pd.DataFrame.from_records(results, columns=columns)
                
            cursor.close()
            conn.close()
            
            if asDataFrame: return df
            return results
        else:     
            results = cursor.fetchall()
            if asDataFrame:
                columns = [column[0] for column in cursor.description]
                df = pd.DataFrame.from_records(results, columns=columns)
                
            cursor.close()
            conn.close()
            if asDataFrame: return df
            return results

    except Exception as ex:
        sqlstate = ex.args[1]
        print("GETDATA ERROR:",params,query,sqlstate)   
        pass
        return False


def Fast_UpdateDatabase(process, query, dataValues):
    if LOCAL_SYSTEM:
        #MS ACCESS CURSOR AND QUERY
        conn = pyodbc.connect(r'Driver={Microsoft Access Driver (*.mdb, *.accdb)};DBQ='+os.path.dirname(os.path.abspath(__file__))+'\db_BetScanner.accdb;')
        
    else:
        conn = pyodbc.connect('DRIVER={'+DB_DRIVER+'};SERVER='+DB_SERVER+';DATABASE='+DB_DATABASE+';UID='+DB_USERNAME+';PWD='+ DB_PASS+';TrustServerCertificate=yes;')

    try:

        cursor = conn.cursor()
        cursor.fast_executemany = True    
        cursor.executemany(query,dataValues)
        cursor.commit()
        cursor.close()
        conn.close()
        if PRINT_SUCCESS: print("Success:",process)
        return True

    except pyodbc.Error as ex:
        
        sqlstate = ex.args[1]
        print("ERROR:",process,sqlstate)   
        pass
        return False  