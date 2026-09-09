async (page) => {
  const trip = {
    id: 'design-review', title: '강릉·속초 3박 4일 · 검토 샘플',
    startDate: '2026-10-09', endDate: '2026-10-12',
    regions: [{id:'g',name:'강릉',order:0},{id:'s',name:'속초',order:1}],
    stops: [
      {id:'a',name:'안목해변',regionId:'g',date:'2026-10-09',order:0,kind:'place',stayMinutes:60,location:{lat:37.773,lng:128.9475}},
      {id:'b',name:'점심 식사',regionId:'g',date:'2026-10-09',order:1,kind:'meal',stayMinutes:60,location:null},
      {id:'c',name:'오죽헌',regionId:'g',date:'2026-10-09',order:2,kind:'place',stayMinutes:90,location:{lat:37.7793,lng:128.878}},
      {id:'d',name:'카페에서 쉬기',regionId:'g',date:'2026-10-10',order:0,kind:'break',stayMinutes:60,location:null},
      {id:'e',name:'속초관광수산시장',regionId:'s',date:'2026-10-11',order:0,kind:'place',stayMinutes:90,location:{lat:38.205,lng:128.5905}},
      {id:'f',name:'바닷가 산책 · 장소 미정',regionId:'s',date:null,order:0,kind:'place',stayMinutes:null,location:null},
    ].map(x=>({...x,address:'',memo:'',fixedTime:null,excluded:false,locationStatus:x.location?'verified':'unverified',placeRef:x.location?{provider:'fixture',id:x.id,url:null}:null})),
    stays: [
      {id:'h1',name:'강릉 테스트 호텔',regionId:'g',checkIn:'2026-10-09',checkOut:'2026-10-11',location:{lat:37.7919,lng:128.9152}},
      {id:'h2',name:'속초 테스트 게스트하우스',regionId:'s',checkIn:'2026-10-11',checkOut:'2026-10-12',location:{lat:38.1907,lng:128.6014}},
    ].map(x=>({...x,address:'',checkInTime:null,checkOutTime:null,reservation:'unknown',memo:'',locationStatus:'verified',placeRef:{provider:'fixture',id:x.id,url:null}})),
    status:'draft',createdAt:'2026-09-09T07:00:00Z',updatedAt:'2026-09-09T07:00:00Z',schemaVersion:1
  };
  await page.goto('http://127.0.0.1:4400/trips');
  await page.evaluate(trip=>localStorage.setItem('tc.test.trips.v1',JSON.stringify({version:1,trips:{[trip.id]:trip}})),trip);
  const root='output/playwright/design-review/';
  const captures=[
    ['desktop-days',1440,1000,'/trips/design-review?tab=days&day=2026-10-09'],
    ['mobile-days',390,844,'/trips/design-review?tab=days&day=2026-10-09'],
    ['mobile-overview',390,844,'/trips/design-review?tab=overview'],
    ['mobile-stays',390,844,'/trips/design-review?tab=stays'],
    ['mobile-list',390,844,'/trips'],
    ['mobile-new-trip',390,844,'/trips/new'],
    ['mobile-add-place',390,844,'/trips/design-review/stops/new'],
    ['mobile-add-stay',390,844,'/trips/design-review/stays/new'],
  ];
  const metrics=[];
  for(const [name,width,height,route] of captures){
    await page.setViewportSize({width,height});
    await page.goto('http://127.0.0.1:4400'+route);
    await page.locator('h1').waitFor();
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:root+name+'.png',fullPage:true});
    if(name==='mobile-days'||name==='desktop-days')await page.screenshot({path:root+name+'-viewport.png'});
    metrics.push({name,...await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent-deep')}))});
  }
  console.log(JSON.stringify(metrics));
}
