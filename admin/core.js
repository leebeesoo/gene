// 공용 헬퍼. 화면은 App.register(key,{title,render(el,params)})로 등록
(function(){
  const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  const won=n=>(n<0?"−":"")+Math.abs(Math.round(n)).toLocaleString("ko-KR")+"원";
  const partner=id=>DB.partners.find(p=>p.id===id);
  const booking=id=>DB.bookings.find(b=>b.id===id);
  const STATUS_TONE={"매칭대기":"warn","배정완료":"info","방문중":"accent","완료":"ok","취소":"mute","분쟁":"bad",
    "활성":"ok","심사중":"warn","정지":"bad","지급완료":"ok","지급예정":"info","보류":"bad","미처리":"bad","처리중":"warn"};
  const pill=s=>`<span class="pill ${STATUS_TONE[s]||"mute"}">${esc(s)}</span>`;
  const screens={};
  function toast(msg){const t=document.getElementById("toast");t.textContent=msg;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2200)}
  function openDrawer(html,onMount){const d=document.getElementById("drawer");d.querySelector(".drawer-body").innerHTML=html;d.hidden=false;document.getElementById("scrim").hidden=false;onMount&&onMount(d.querySelector(".drawer-body"))}
  function closeDrawer(){document.getElementById("drawer").hidden=true;document.getElementById("scrim").hidden=true}
  function go(key,params){location.hash=key+(params?"-"+params:"")}
  function render(){
    const raw=decodeURIComponent((location.hash||"#home").slice(1)); const [key,...rest]=raw.split("-"); const scr=screens[key]||screens.home; if(!scr)return;
    document.querySelectorAll(".nav a").forEach(a=>a.classList.toggle("on",a.dataset.k===(screens[key]?key:"home")));
    document.getElementById("pageTitle").textContent=scr.title;
    const el=document.getElementById("view"); el.innerHTML=""; closeDrawer(); scr.render(el,rest.join("-")||null); updateBadges();
  }
  function updateBadges(){
    const n={bookings:DB.bookings.filter(b=>b.status==="매칭대기"||b.status==="분쟁").length,
      dispatch:DB.bookings.filter(b=>b.status==="매칭대기").length,
      partners:DB.partners.filter(p=>p.status==="심사중").length,
      settlement:DB.payouts.filter(p=>p.status==="보류").length,
      cs:DB.tickets.filter(t=>t.status==="미처리").length};
    document.querySelectorAll(".nav a").forEach(a=>{const b=a.querySelector(".badge");if(b){const v=n[a.dataset.k];b.textContent=v||"";b.hidden=!v}});
  }
  window.App={register:(k,s)=>{screens[k]=s},render,go,toast,openDrawer,closeDrawer,updateBadges,esc,won,pill,partner,booking};
  addEventListener("hashchange",render);
  addEventListener("keydown",e=>{if(e.key==="Escape")closeDrawer()});
  addEventListener("DOMContentLoaded",()=>{document.getElementById("scrim").onclick=closeDrawer;document.getElementById("drawerClose").onclick=closeDrawer;render()});
})();
