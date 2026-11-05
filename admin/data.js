// 가상 데이터 (실제 고객·파트너 아님). 기준일 2026-11-05
(function(){
  let s=20261105; const r=()=>(s=(s*16807)%2147483647)/2147483647;
  const pick=a=>a[Math.floor(r()*a.length)], int=(a,b)=>a+Math.floor(r()*(b-a+1));
  const SERVICES=[{k:"청소",base:120000},{k:"에어컨",base:90000},{k:"이사",base:450000},{k:"수리",base:70000},{k:"방역",base:80000}];
  const REGIONS=["강남구","서초구","송파구","마포구","성동구","용산구"];
  const LAST="김이박최정강조윤장임한오서신권황안송류홍".split("");
  const FIRST=["민준","서연","도윤","지우","하준","서윤","예준","지민","주원","하은","시우","수아","지호","채원","준서","지유","유준","다은","현우","소율"];
  const name=()=>pick(LAST)+pick(FIRST);
  const partners=[];
  for(let i=0;i<14;i++){
    const skills=[...new Set([pick(SERVICES).k,pick(SERVICES).k])];
    const status=i<10?"활성":i<12?"심사중":"정지";
    partners.push({id:"P"+(101+i),name:name()+(skills[0]==="이사"?" 익스프레스":" 마스터"),skills,region:pick(REGIONS),
      rating:+(3.9+r()*1.1).toFixed(1),acceptRate:int(62,99),responseMin:int(3,48),cancelRate:+(r()*9).toFixed(1),
      reorderRate:int(12,61),jobs30:int(4,52),grade:pick(["골드","실버","브론즈"]),status,joined:`2025-${String(int(1,12)).padStart(2,"0")}-${String(int(1,28)).padStart(2,"0")}`,
      phone:`010-${int(1000,9999)}-${int(1000,9999)}`,docs:status==="심사중"?pick(["사업자등록증 확인 필요","보험증권 만료","신분증 재제출"]):null});
  }
  const active=partners.filter(p=>p.status==="활성");
  const STAT=["매칭대기","매칭대기","매칭대기","배정완료","배정완료","배정완료","방문중","완료","완료","완료","완료","취소","분쟁"];
  const bookings=[];
  for(let i=0;i<42;i++){
    const sv=pick(SERVICES), status=STAT[i%STAT.length], day=status==="완료"||status==="취소"||status==="분쟁"?int(1,4):int(5,7);
    const hour=int(8,18), price=Math.round(sv.base*(0.8+r()*0.8)/1000)*1000;
    const cand=active.filter(p=>p.skills.includes(sv.k));
    const partner=status==="매칭대기"?null:(pick(cand.length?cand:active)).id;
    bookings.push({id:"B-"+(24810+i),service:sv.k,customer:name(),phone:`010-${int(1000,9999)}-${int(1000,9999)}`,
      region:pick(REGIONS),address:`${int(10,480)}번길 ${int(1,30)}`,date:`2026-11-0${day}`,hour,duration:sv.k==="이사"?5:int(1,3),
      price,fee:Math.round(price*0.15),status,partner,quotes:status==="매칭대기"?int(0,4):null,
      deadlineMin:status==="매칭대기"?int(-20,180):null,late:status==="배정완료"&&r()<0.25,
      memo:pick(["주차 가능","반려견 있음","오전 선호","엘리베이터 없음 4층","현관 비밀번호 문자로 전달",""]),
      createdAt:`2026-11-0${Math.max(1,day-1)} ${String(int(8,22)).padStart(2,"0")}:${String(int(0,59)).padStart(2,"0")}`});
  }
  const payouts=[];
  ["2026-10-20","2026-10-27","2026-11-03","2026-11-10"].forEach((d,ri)=>active.forEach(p=>{
    const gross=int(3,40)*10000*3, fee=Math.round(gross*0.15), adj=r()<0.15?-int(1,5)*10000:0;
    payouts.push({id:`S${ri}${p.id}`,round:d,partner:p.id,gross,fee,adj,net:gross-fee+adj,
      status:ri<2?"지급완료":ri===2?(r()<0.2?"보류":"지급완료"):"지급예정",hold:null});
  }));
  payouts.filter(x=>x.status==="보류").forEach(x=>x.hold=pick(["계좌 실명 불일치","분쟁 진행 중","세금계산서 미발행"]));
  const tickets=[];
  const TK=[["환불 요청","청소 후 얼룩이 남아 있어요. 부분 환불 가능할까요?"],["일정 변경","방문 시간을 오후로 바꾸고 싶습니다."],["파트너 노쇼","예약 시간 30분이 지났는데 연락이 안 됩니다."],["리뷰","에어컨 청소 아주 꼼꼼했어요. 다음에도 부탁드려요."],["견적 문의","원룸 이사 견적이 너무 차이 나는데 이유가 뭔가요?"],["결제 오류","카드 결제가 두 번 된 것 같아요."],["리뷰","시간 약속을 안 지켰고 마무리가 엉망이었습니다."],["파트너 문의","정산 금액이 예상보다 적게 들어왔어요."]];
  for(let i=0;i<16;i++){const [type,text]=TK[i%TK.length]; const b=bookings[int(0,41)];
    tickets.push({id:"T-"+(7300+i),type,from:type==="파트너 문의"?"파트너":"고객",name:type==="파트너 문의"?(partners.find(p=>p.id===b.partner)||active[0]).name:b.customer,
      booking:b.id,text,rating:type==="리뷰"?(text.includes("엉망")?1:5):null,status:i<9?"미처리":i<12?"처리중":"완료",
      createdAt:`11/0${int(3,5)} ${String(int(8,22)).padStart(2,"0")}:${String(int(0,59)).padStart(2,"0")}`,replies:[]});}
  window.DB={today:"2026-11-05",nowHour:14,SERVICES,REGIONS,partners,bookings,payouts,tickets};
})();
