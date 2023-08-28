import React from "react";
import {Card} from "primereact/card";
import {ColorType, createChart} from "lightweight-charts";
import * as moment from "moment";
import {Button} from "primereact/button";
import {Toast} from "primereact/toast";
import {API_BASEPATH, API_NOTIFY, API_SCREENSHOT, API_TRANSACTIONS} from "./constant";
import {BlockUI} from "primereact/blockui";
import {ProgressSpinner} from "primereact/progressspinner";
import {SplitButton} from "primereact/splitbutton";
import {ScrollPanel} from "primereact/scrollpanel";

class Graph extends React.Component {
    intervalID = "";

    constructor(props) {
        super(props);

        this.intervalID = ""
        this.eventID = props.eventID;
        this.oldEvent = props.oldEvent;
        this.racing = props.racing;

        this.selectionID = props.selectionID;
        this.selectionName = props.selectionName;
        this.marketID = props.marketID;
        this.marketName = props.marketName;
        this.sport = props.sport;
        this.title = props.title;
        this.index = props.index;
        this.props = props
        this.refresh = props.refresh;
        this.keepLocked = props.keepLocked;

        this.visibleRange = {from: 0, to: 0, range: 0}

        this.state = {
            priceData: [],
            volumeData: [],
            maxData: [],
            totalData: [],
            lastPrice: 0,
            maxVolume: 0,
            totalVolume: 0,
            blockedPanel: false,
            index: 0,
        }

        this.graphCount = props.count;
        this.buttonLabel = this.selectionName + ' ' + this.marketName;

        this.buttonActionModels = [
            {
                label: 'Reset',
                icon: 'pi pi-refresh',
                command: () => {
                    this.onRefresh()
                }
            },
            {
                label: 'LAY ' + this.buttonLabel,
                icon: 'pi pi-send',
                command: () => {
                    this.onLayClicked()
                }
            },
            {
                label: 'BACK ' + this.buttonLabel,
                icon: 'pi pi-angle-left',
                command: () => {
                    this.onBackClicked()
                }
            },
            {
                label: 'To Betfair',
                icon: 'pi pi-at',
                command: () => {
                    this.onBetFairClicked()
                }
            },
        ]
    }

    componentDidMount() {
        this.priceChart = createChart(this.priceContainerRef, {
            layout: {
                background: { type: ColorType.Solid, color: '#f2f2f2' },
                textColor: '#222',
            },
            // localization: {
            //     dateFormat: 'yyyy-MM-dd'
            // },
            crosshair: {
                horzLine: {
                    visible: false,
                    labelVisible: false,
                },
                vertLine: {
                    labelVisible: false,
                },
            },
            timeScale: {
                minBarSpacing: 0.000001,
                lockVisibleTimeRangeOnResize: true,
                visible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
                // timeVisible: false,
            },
            handleScale: {
                mouseWheel: true,
                pinch: false,
                axisPressedMouseMove: false,
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            width: this.priceContainerRef.clientWidth-10,
            height: 200,
        });

        this.volumeChart = createChart(this.volumeContainerRef, {
            layout: {
                background: { type: ColorType.Solid, color: '#f2f2f2' },
                textColor: '#333',
            },
            // localization: {
            //     dateFormat: 'yyyy-MM-dd'
            // },
            crosshair: {
                horzLine: {
                    visible: false,
                    labelVisible: false,
                },
                vertLine: {
                    labelVisible: false,
                },
            },
            timeScale: {
                minBarSpacing: 0.000001,
                lockVisibleTimeRangeOnResize: true,
                visible: false,
                fixLeftEdge: true,
                fixRightEdge: true,
                // timeVisible: false,
            },
            handleScale: {
                mouseWheel: true,
                pinch: false,
                axisPressedMouseMove: false,
            },
            handleScroll: {
                mouseWheel: false,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            width: this.volumeContainerRef.clientWidth-10,
            height: 200,
        });

        this.priceSeries = this.priceChart.addLineSeries({ color: '#42a5f5', lineWidth: 2, lastValueVisible: true, });

        this.volumeSeriesMax = this.volumeChart.addHistogramSeries({ color: '#00f', lastValueVisible: false, });
        this.volumeSeries = this.volumeChart.addHistogramSeries({ color: '#ff1221', lastValueVisible: true, });

        this.priceSeries.setData([]);
        // this.priceChart.timeScale().fitContent()

        this.volumeSeries.setData([]);
        this.volumeSeriesMax.setData([]);
        // this.volumeChart.timeScale().fitContent()

        this.priceChart.subscribeCrosshairMove((param) => {
            let toolTipWidth = 180;
            let toolTipHeight = 80;
            let toolTipMargin = 5;

            let container = document.getElementById('price_graph_'+this.index)
            let toolTip = document.getElementById('price_tooltip_'+this.index)
            if (container==null || toolTip==null)
                return;

            if (!param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
                toolTip.style.display = 'none';
                return;
            }

            let dateStr = this.state.volumeData.length>param.time ? moment.utc(this.state.volumeData[param.time].timestamp).format('YYYY-MM-DD HH:mm:ss') : ''
            toolTip.style.display = 'block';
            let price = param.seriesPrices.get(this.priceSeries);
            let volume = 0
            let volumeItem = this.state.volumeData.find((item)=>item.time==param.time)
            if (volumeItem)
                volume = volumeItem.value;
            else {
                volumeItem = this.state.maxData.find((item)=>item.time==param.time)
                if (volumeItem)
                    volume = volumeItem.value;
            }

            toolTip.innerHTML = '<div style="font-size: 14px;">' + dateStr + '</div>' +
                '<div style="font-size: 12px; margin: 4px 0px">Price: ' + price + '</div>' +
                '<div style="font-size: 12px; margin: 4px 0px">Volume: ' + volume + '</div>' +
                '';

            var y = param.point.y;

            var left = param.point.x + toolTipMargin;
            if (left > container.clientWidth - toolTipWidth) {
                left = param.point.x - toolTipMargin - toolTipWidth;
            }

            var top = y + toolTipMargin;
            if (top > container.clientHeight - toolTipHeight) {
                top = y - toolTipHeight - toolTipMargin;
            }

            toolTip.style.left = left + 'px';
            toolTip.style.top = top + 'px';
        });

        this.volumeChart.subscribeCrosshairMove((param) => {
            let toolTipWidth = 180;
            let toolTipHeight = 80;
            let toolTipMargin = 5;

            let container = document.getElementById('volume_graph_'+this.index)
            let toolTip = document.getElementById('volume_tooltip_'+this.index)
            if (container==null || toolTip==null)
                return;

            if (!param.time || param.point.x < 0 || param.point.x > container.clientWidth || param.point.y < 0 || param.point.y > container.clientHeight) {
                toolTip.style.display = 'none';
                return;
            }

            let dateStr = this.state.volumeData.length>param.time ? moment.utc(this.state.volumeData[param.time].timestamp).format('YYYY-MM-DD HH:mm:ss') : ''
            toolTip.style.display = 'block';
            let volume = param.seriesPrices.get(this.volumeSeries);
            if (typeof volume === "undefined") {
                volume = param.seriesPrices.get(this.volumeSeriesMax);
            }

            let price = 0
            let priceItem = this.state.priceData.find((item)=>item.time==param.time)
            if (priceItem)
                price = priceItem.value;

            toolTip.innerHTML = '<div style="font-size: 14px;">' + dateStr + '</div>' +
                '<div style="font-size: 12px; margin: 4px 0px">Price: ' + price + '</div>' +
                '<div style="font-size: 12px; margin: 4px 0px">Volume: ' + volume + '</div>' +
                '';

            var y = param.point.y;

            var left = param.point.x + toolTipMargin;
            if (left > container.clientWidth - toolTipWidth) {
                left = param.point.x - toolTipMargin - toolTipWidth;
            }

            var top = y + toolTipMargin;
            if (top > container.clientHeight - toolTipHeight) {
                top = y - toolTipHeight - toolTipMargin;
            }

            toolTip.style.left = left + 'px';
            toolTip.style.top = top + 'px';
        });


        this.priceChart.timeScale().subscribeVisibleLogicalRangeChange((newVisibleTimeRange) => {
            // console.log("A>", this.index, this.priceChart.timeScale().getVisibleRange(), this.volumeChart.timeScale().getVisibleRange())
            if (newVisibleTimeRange==null || this.volumeChart.timeScale().getVisibleLogicalRange()==null)
                return;
            this.volumeChart.timeScale().setVisibleLogicalRange(newVisibleTimeRange)
            this.visibleRange.from  = newVisibleTimeRange.from;
            this.visibleRange.to = newVisibleTimeRange.to;
            if (this.index==0)
                console.log("subscribe", newVisibleTimeRange)
        })

        this.volumeChart.timeScale().subscribeVisibleLogicalRangeChange((newVisibleTimeRange) => {
            if (newVisibleTimeRange==null || this.priceChart.timeScale().getVisibleLogicalRange()==null)
                return;
            this.priceChart.timeScale().setVisibleLogicalRange(newVisibleTimeRange)
            this.visibleRange.from  = newVisibleTimeRange.from;
            this.visibleRange.to = newVisibleTimeRange.to
        })

        this.intervalID = setTimeout(() => {
            this.getData()
        }, 10)

        window.addEventListener('resize', this.handleResize);
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleResize);
        // this.priceChart.remove();
        // this.volumeChart.remove();

        if (this.intervalID!=null)
            clearTimeout(this.intervalID)
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.refresh < this.props.refresh) {
            this.refresh = this.props.refresh;
            this.keepLocked = this.props.keepLocked;

            if (this.intervalID!=null)
                clearTimeout(this.intervalID)

            this.intervalID = setTimeout(() => {
                this.getData()
            }, 10)
        }

    }

    handleResize = () => {
        this.priceChart.applyOptions({ width: this.priceContainerRef.clientWidth });
        this.volumeChart.applyOptions({ width: this.volumeContainerRef.clientWidth });
    };

    getData = () => {
        let params = "evID=" + this.eventID;
        if (this.oldEvent.toLowerCase()=="yes")
            params += "&oldEvent="+this.oldEvent;
        if (this.racing.toLowerCase()=="yes")
            params += "&racing="+this.racing;

        fetch(API_BASEPATH + API_TRANSACTIONS + '?' + params +'&selectionID='+this.selectionID+'&marketID='+this.marketID+'&lastXminutes='+this.props.getLastMinutes()).then(res => res.json()).then(d => {
            let transactionData = d;
            let pData = [], vData = [];
            let pMap = {};
            let tData = []
            let lastPrice = 0;
            let totalVolume = 0;
            let maxVolume = 0, maxIndex = 0;

            let len = Object.keys(transactionData.TimeValue).length
            for(let i=0; i<len; i++) {
                pData.push({
                    time: i,//+this.state.index,
                    timestamp: Number(transactionData.TimeValue[''+i]),
                    value: transactionData.Price[''+i],
                })

                vData.push({
                    time: i,//+this.state.index,
                    timestamp: Number(transactionData.TimeValue[''+i]),
                    value: transactionData.Volume[''+i],
                })

                if (maxVolume<Number(transactionData.Volume[''+i])) {
                    maxVolume = Number(transactionData.Volume[''+i]);
                    maxIndex = i;
                }

                lastPrice = transactionData.Price[''+i]
                totalVolume += Number(transactionData.Volume[''+i])
            }

            if (len>0) {
                // pData.push({
                //     time: len,//+this.state.index,
                //     timestamp: Number(transactionData.TimeValue[''+(len-1)]),
                //     value: transactionData.Price[''+(len-1)],
                // })
                //
                // vData.push({
                //     time: len,//+this.state.index,
                //     timestamp: Number(transactionData.TimeValue[''+(len-1)]),
                //     value: transactionData.Volume[''+(len-1)],
                // })
            }

            pData.forEach((row, index)=> {
                if (pMap[row.value]==undefined) {
                    pMap[row.value] = Number(vData[index].value);
                } else {
                    pMap[row.value] +=  Number(vData[index].value);
                }
            })

            let maxPrice = 0;
            Object.keys(pMap).forEach((key) => {
                let v = Number(pMap[key].toFixed(0));
                if (maxPrice < v) {
                    maxPrice = v;
                }

                tData.push({ price: Number(key), volume: v})
            })
            tData.sort((a,b)=>a.price-b.price)

            let mData = []
            for (let i=0; i<maxIndex; i++)
                mData.push({
                    time: i,//+this.state.index,
                    timestamp: vData[i].timestamp,
                    value: 0,
                })
            let temp = vData.splice(maxIndex, 1);
            mData.push(temp[0])
            for (let i=maxIndex+1; i<vData.length; i++)
                mData.push({
                    time: i,//+this.state.index,
                    timestamp: vData[i].timestamp,
                    value: 0,
                })

            this.setState({priceData: pData, volumeData: vData, maxData: mData, totalData: tData})
            this.setState({
                lastPrice, maxVolume: maxPrice,
                totalVolume: totalVolume.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            })

            this.priceSeries.setData(pData)
            this.volumeSeries.setData(vData)
            this.volumeSeriesMax.setData(mData)

            if (len>0) {
                if (this.visibleRange.range==0 || this.keepLocked) {
                    this.visibleRange.from = 0;
                    this.visibleRange.to = len-1;
                } else {
                    if (len>=this.visibleRange.range) {
                        let offset = (len-1) - this.visibleRange.to;
                        this.visibleRange.to += offset;
                        this.visibleRange.from += offset;
                    } else {
                        let offset = this.visibleRange.range / (this.visibleRange.to - this.visibleRange.from)
                        this.visibleRange.to = len-1;
                        this.visibleRange.from = len-1 - (len-1) / offset;
                        if (this.visibleRange.from<0)
                            this.visibleRange.from = 0;
                    }
                }

                this.visibleRange.range = len;

                setTimeout(()=> {
                    this.priceChart.timeScale().setVisibleLogicalRange({from: this.visibleRange.from, to: this.visibleRange.to})
                    this.volumeChart.timeScale().setVisibleLogicalRange({from: this.visibleRange.from, to: this.visibleRange.to})
                }, 100)
            }

            if (this.index==0)
                console.log("Data", this.keepLocked, this.visibleRange)

            setTimeout(()=> {
                if (document.getElementById('total_table_'+this.index)==null)
                    return;

                let w = document.getElementById('total_table_'+this.index).clientWidth
                let f_index = 0;
                this.state.totalData.forEach((row, index)=> {
                    if (row.volume==this.state.maxVolume) {
                        f_index=index
                    }
                })

                let left = w / this.state.totalData.length * (f_index-3)
                if (left<0)
                    left  = 0;
                document.getElementById('total_scroll_'+this.index).scrollTo({left: left, behavior:'smooth'})
            }, 500)

            if (this.oldEvent.toLowerCase()=="yes") {

            } else {
                this.intervalID = setTimeout(() => {
                    this.getData()
                }, this.racing=="No" ? 30*1000 : 5 * 1000)
            }
        })
    }

    onBackClicked = () => {
        this.sendNotification("BACK " + this.buttonLabel)
    }

    onLayClicked = () => {
        this.sendNotification("LAY " + this.buttonLabel)
    }

    sendNotification = (order) => {
        this.setState({blockedPanel: true})
        fetch(API_BASEPATH + API_NOTIFY + '?evID=' + this.eventID+'&order='+order+'&selectionID='+this.selectionID+'&marketID='+this.marketID+'&sport='+this.sport).then(res => res.text()).then(d => {
            this.setState({blockedPanel: false})
            this.toast.show({severity:'success', summary: 'Success', detail:'Successfully Sent', life: 3000});
        })
    }

    onBetFairClicked = () => {
        let url = 'https://www.betfair.com/exchange/plus/'+this.sport.toLowerCase()+'/market/'+this.marketID;
        window.open(url, "_blank")
    }

    onScreenshot = () => {
        let priceImage = this.priceChart.takeScreenshot().toDataURL();
        let volumeImage = this.volumeChart.takeScreenshot().toDataURL();

        this.setState({blockedPanel: true})
        fetch(API_BASEPATH + API_SCREENSHOT + '?evID=' + this.eventID+'&selectionID='+this.selectionID+'&marketID='+this.marketID+'&sport='+this.sport+'&priceImage='+priceImage + '&volumeImage='+volumeImage).then(res => res.text()).then(d => {
            this.setState({blockedPanel: false})
            this.toast.show({severity:'success', summary: 'Success', detail:'Successfully Sent', life: 3000});
        })
    }

    onRefresh = () => {
        this.visibleRange.from = 0;
        this.visibleRange.to = this.visibleRange.range-1;

        this.priceChart.timeScale().setVisibleLogicalRange({from: 0, to: this.visibleRange.range-1})
        this.volumeChart.timeScale().setVisibleLogicalRange({from: 0, to: this.visibleRange.range-1})
    }

    render() {
        const style = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
        let columnStyle = "lg:col-4 md:col-6"
        if (this.graphCount==1) {
            columnStyle = "";
        } else if (this.graphCount==2) {
            columnStyle = "lg:col-6 md:col-6"
        }

        return (
            <div className={'mb-5 col-12 p-1 ' + columnStyle}>
                <BlockUI blocked={this.state.blockedPanel}>
                    <h2 className="selection_name">{this.title}</h2>
                    <div className="mb-4" id="toolbar_graph" data-html2canvas-ignore>
                        <SplitButton label="Actions" className="p-button-sm" model={this.buttonActionModels}></SplitButton>
                    </div>

                    <Card title={'Price for: '+this.title + ', Last: ' + this.state.lastPrice} className="relative" id={'price_graph_'+this.index}>
                        <div className="graph_container" ref={(el) => this.priceContainerRef = el}></div>
                        <div className="floating-tooltip-2" id={'price_tooltip_'+this.index}></div>
                    </Card>

                    <div className="pd-1 mt-1">&nbsp;</div>

                    <Card title={'Volume for: '+this.title} className="relative" id={'volume_graph_'+this.index}>
                        <div className="graph_container" ref={(el) => this.volumeContainerRef = el}></div>
                        <div className="floating-tooltip-2" id={'volume_tooltip_'+this.index}></div>
                    </Card>

                    <div className=" mt-1">&nbsp;</div>

                    <Card>
                        <h5 className="total_volume">{this.state.totalVolume}</h5>
                        <div style={{ width: '100%', height: '88px', 'overflowX': 'auto' }} id={'total_scroll_'+this.index}>
                        <table className="full-width total_table p-datatable-table p-datatable-gridlines" id={'total_table_'+this.index} >
                            <tbody>
                                <tr>
                                {
                                    this.state.totalData.map((row, index) => {
                                        return (
                                                <td key={index} className={row.volume==this.state.maxVolume ? 'price highlighted': 'price'}>{row.price}</td>
                                        )
                                    })
                                }
                                </tr>
                                <tr>
                                    {
                                        this.state.totalData.map((row, index) => {
                                            return (
                                                <td key={index*2} className={row.volume==this.state.maxVolume ? 'volume highlighted': 'volume'}>{row.volume.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</td>
                                            )
                                        })
                                    }
                                </tr>
                            </tbody>
                        </table>
                        </div>
                    </Card>

                    <Toast ref={(el) => this.toast = el} />
                    <ProgressSpinner style={style} className={this.state.blockedPanel ? '' : 'hidden'} />
                </BlockUI>
            </div>
        )
    }
}

export default Graph;
