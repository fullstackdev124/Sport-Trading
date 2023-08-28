import logo from './logo.svg';
import 'primereact/resources/themes/md-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import './App.css';
import React, {createRef, useEffect, useState} from "react";
import {API_BASEPATH, API_MATCHINFO, API_SCREENSHOT, API_SELECTION, API_TRANSACTIONS} from "./constant";
import {BlockUI} from "primereact/blockui";
import {ProgressSpinner} from "primereact/progressspinner";
import Graph from "./Graph";
import {Button} from "primereact/button";
import html2canvas from "html2canvas";
import {InputNumber} from "primereact/inputnumber";
import {Checkbox} from "primereact/checkbox";


let evID = ""
let marketID = ""
let oldEvent = "No";
let intervalID;
let appTitle = ""
let isFirst = true;
let racing = "No";

function App(props) {
  const searchParams = new URLSearchParams(document.location.search)
  evID = searchParams.get('evID')!=null ? searchParams.get('evID') : ''
  marketID = searchParams.get('marketID')!=null ? searchParams.get('marketID') : ''
  oldEvent = searchParams.get('oldEvent')!=null ? searchParams.get('oldEvent') : 'No'
  racing = searchParams.get('racing')!=null ? searchParams.get('racing') : 'No'

  const [matchingTitle, setMatchingTitle] = useState('No Match')
  const [selectionData, setSelectionData] = useState([])
  const [blockedPanel, setBlockedPanel] = useState(false)
  const [lastMinutes, setLastMinutes] = useState(0)
  const [refresh, setRefresh] = useState(0)
  const [keepLocked, setKeepLocked]= useState(true);

  const getGraphData = () => {
    if (evID=="")
      return;

    let params = "evID=" + evID;
    if (marketID!="")
      params += '&marketID='+marketID;
    if (oldEvent.toLowerCase()=="yes")
      params += "&oldEvent="+oldEvent;
    if (racing.toLowerCase()=="yes")
      params += "&racing="+racing;

    fetch(API_BASEPATH + API_MATCHINFO + '?'+params).then(res => res.text()).then(d => {
      setMatchingTitle(d)

      let index = d.indexOf('----')
      document.title = index>-1 ? d.substring(0, index) : d
    })

    params = "evID=" + evID;
    if (oldEvent.toLowerCase()=="yes")
      params += "&oldEvent="+oldEvent;
    if (marketID!="")
      params += '&marketID='+marketID;
    if (racing.toLowerCase()=="yes")
      params += "&racing="+racing;

    fetch(API_BASEPATH + API_SELECTION + '?' + params).then(res => res.json()).then(d => {
      let selectedData = [];
      let isNewSelection = d.length != selectionData.length;

      d.forEach((item, index) => {
        let selectionLabel = ""
        const [marketID, selectionID, marketName, selectionName, homeName, awayName, pointValue, sport] = item;

        if (selectionName == 'Away')
          selectionLabel = awayName
        if (selectionName == 'Home')
          selectionLabel = homeName
        if (selectionName == 'Draw')
          selectionLabel = "Draw"

        selectionLabel += " " + marketName + " " + selectionName;
        let key = marketID+selectionID+marketName+selectionName+sport+pointValue;
        let exist = selectionData.find((row)=>row.identity==key);
        if (exist==null)
          isNewSelection = true;

        selectedData.push({
          identity: key,
          title: selectionLabel,
          marketID, selectionID, marketName, selectionName, sport
        })
      })

      setBlockedPanel(false)

      // if (isNewSelection) {
        setSelectionData(selectedData)
      // }
    })
  };

  const onScreenShot = async () => {
    const canvas = await html2canvas(document.body);
    const dataURL = canvas.toDataURL('image/jpg');

    let w = window.open("", 'about:blank')
    var image = new Image();
    image.src = dataURL;
    w.document.write(image.outerHTML)
    w.document.close()

    fetch(API_BASEPATH + API_SCREENSHOT + '?evID=' + this.eventID+'&image='+dataURL).then(res => res.text()).then(d => {
      // this.setState({blockedPanel: false})
      // this.toast.show({severity:'success', summary: 'Success', detail:'Successfully Sent', life: 3000});
    })

  }

  useEffect(() => {
    if (evID!='') {
      // setBlockedPanel(true)
      if (isFirst)
        intervalID = setTimeout(getGraphData, 10)
      else if (oldEvent.toLowerCase()!="yes")
        intervalID = setTimeout(getGraphData, 30*1000)
      isFirst = false;
    }

    return () => {
      if (intervalID!=null)
        clearTimeout(intervalID)
    }
  }, [selectionData]);

  const getLastMinutes = () => {
    return lastMinutes
  }

  const onRefresh = () => {
    setRefresh(refresh+1)
  }

  const onChecked = (e) => {
    setKeepLocked(e.checked)
    onRefresh()
  }

  const style = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
      <BlockUI blocked={blockedPanel}>
        <div className="grid grid-nogutter pl-2 pr-2">
          <div className="col-12 text-right">
            <h2 className="matching_title text-left ">{matchingTitle}</h2>
          </div>
          <div className="col-12 mt-3 mb-5 flex flex-wrap text-right" id="toolbar" data-html2canvas-ignore>
            <div className="field-checkbox mt-2 mr-3">
              <Checkbox inputId="binary" checked={keepLocked} onChange={e => onChecked(e)} />
              <label htmlFor="binary">Keep Reset</label>
            </div>
            <span className="p-float-label">
              <InputNumber inputId="integeronly" className="mb=2" value={lastMinutes} onValueChange={(e) => setLastMinutes(e.value)} useGrouping={false} style={{maxHeight: '42px'}} />
              <label htmlFor="integeronly" className="mr-2">Last X Minutes</label>
            </span>
            <Button label="Refresh" icon="pi pi-refresh" className=" ml-1 p-button-success" onClick={onRefresh} />
            <Button label="Screenshot" icon="pi pi-image" className=" ml-4 p-button-secondary" onClick={onScreenShot} />
          </div>

          {
            selectionData.map((item, index) => {
                return  (
                    <Graph key={index} refresh={refresh} keepLocked={keepLocked} count={selectionData.length} index={index} getLastMinutes={getLastMinutes} eventID={evID} oldEvent={oldEvent} racing={racing} {...item} />
                )
            })
          }

          <ProgressSpinner style={style} className={blockedPanel ? '' : 'hidden'} />
        </div>
      </BlockUI>
  );
}

export default App;
