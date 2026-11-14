import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, get, set, push, remove, update, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBbHGhDzDXDOlSTRlukZruFzeTZmPOyaCw",
  authDomain: "scalegrid-1c506.firebaseapp.com",
  databaseURL: "https://scalegrid-1c506-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "scalegrid-1c506",
  storageBucket: "scalegrid-1c506.firebasestorage.app",
  messagingSenderId: "594287186699",
  appId: "1:594287186699:web:a26661e4fbbc80e",
  measurementId: "G-3C9NZ9THCQ"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
window.db = database;
let currentEditingAdminId = null;

const $ = id => document.getElementById(id);
const value = id => $(id)?.value?.trim() || "";
const checked = id => !!$(id)?.checked;
const keyFor = file => ({ads:"ads",apps:"apps",websites:"websites",automations:"automations",home:"general"})[file] || null;
const pageKey = keyFor(location.pathname.split("/").pop().replace(".html",""));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function notify(message) { alert(message); }
function requireDb() { if (!database) throw new Error("Firebase database is unavailable."); return database; }

// Fail closed: no admin record, read error, or mismatched email means no dashboard access.
onAuthStateChanged(auth, async user => {
  if (!user) { if (!location.pathname.endsWith("login.html")) location.href = "login.html"; return; }
  try {
    const snap = await get(ref(requireDb(), "admins"));
    const records = snap.exists() ? Object.values(snap.val()) : [];
    const match = records.find(a => a?.email && a.email.toLowerCase() === (user.email || "").toLowerCase());
    if (!match) {
      notify("Access denied. This Google/email account is not listed under Firebase admins.");
      await signOut(auth);
      location.href = "login.html";
      return;
    }
    window.scalegridAdmin = { email:user.email, role:match.role || "normal", permissions:match.permissions || {} };
    if ($("adminIdentity")) $("adminIdentity").textContent = user.email;
    if ($("superAdminTools") && window.scalegridAdmin.role !== "super") $("superAdminTools").hidden = true;
    if ($("admin-users") && window.scalegridAdmin.role !== "super") $("admin-users").hidden = true;
    if (pageKey) loadPageSettings();
    if (typeof window.loadAdminUsers === "function") window.loadAdminUsers();
    if ($("categoryGrid")) loadCategories();
    if ($("notificationsList")) loadNotifications();
  } catch (err) {
    console.error("Admin authorization failed closed:", err);
    notify("Unable to verify admin access. Check Firebase Database read permissions and try again.");
    await signOut(auth);
    location.href = "login.html";
  }
});

window.logoutAdmin = async () => { await signOut(auth); location.href = "login.html"; };

// Dashboard categories: read/write existing categories/<key> records.
async function loadCategories() {
  const target = $("categoryGrid"); if (!target) return;
  try {
    const snap = await get(ref(database, "categories"));
    const rows = snap.exists() ? Object.entries(snap.val()) : [];
    if (!rows.length) return;
    rows.forEach(([key,item]) => {
      const card = [...document.querySelectorAll(".category-card")].find(el => el.querySelector("h3")?.textContent.trim().toLowerCase() === String(item.name || "").toLowerCase());
      if (card) {
        card.dataset.categoryKey = key;
        const toggle = card.querySelector('input[type="checkbox"]');
        if (toggle) toggle.checked = item.enabled !== false;
        if (toggle) toggle.addEventListener("change", () => update(ref(database,`categories/${key}`),{enabled:toggle.checked}).catch(e=>notify(e.message)));
      }
    });
  } catch(e) { console.error("Category load failed",e); }
}
window.toggleVisibility = input => {
  const label = input.closest(".visibility-control")?.querySelector(".status-label");
  if (label) label.textContent = input.checked ? "ON" : "OFF";
};
window.editBox = button => {
  const card = button.closest(".category-card"); if (!card) return;
  window.currentCategoryCard = card;
  $("editModalTitle").value = card.querySelector("h3")?.textContent.trim() || "";
  $("editModalLink").value = card.querySelector(".category-actions a")?.getAttribute("href") || "";
  $("editModalIconValue").value = card.querySelector(".category-icon")?.textContent.trim() || "";
  $("editModalIconType").value = "emoji";
  $("editCategoryModal").style.display = "flex";
};
window.closeEditModal = () => { if ($("editCategoryModal")) $("editCategoryModal").style.display="none"; window.currentCategoryCard=null; };
window.saveCategoryBox = async () => {
  const card=window.currentCategoryCard; if(!card)return;
  const name=value("editModalTitle"), link=value("editModalLink"), icon=value("editModalIconValue");
  if(!name || !link) return notify("Enter both a category name and link.");
  const key=(card.dataset.categoryKey || name.toLowerCase().replace(/[^a-z0-9]+/g,"_"));
  await set(ref(database,`categories/${key}`),{name,link,icon,enabled:card.querySelector('input[type="checkbox"]')?.checked ?? true});
  card.querySelector("h3").textContent=name;
  const a=card.querySelector(".category-actions a"); if(a)a.href=link;
  const i=card.querySelector(".category-icon"); if(i)i.textContent=icon;
  card.dataset.categoryKey=key; window.closeEditModal(); notify("Category saved.");
};
window.deleteCategoryBox = async () => {
  const card=window.currentCategoryCard; if(!card || !confirm("Delete this category?"))return;
  const key=card.dataset.categoryKey;
  if(key) await remove(ref(database,`categories/${key}`));
  card.remove(); window.closeEditModal();
};

// Admin users
window.loadAdminUsers = async () => {
  if (!$("superAdminsList") || !$("normalAdminsList")) return;
  const snap=await get(ref(database,"admins")); const admins=snap.exists()?snap.val():{};
  $("superAdminsList").innerHTML=""; $("normalAdminsList").innerHTML="";
  Object.entries(admins).forEach(([id,a])=>{
    const el=document.createElement("div"); el.className="admin-user-row";
    const title=document.createElement("strong"); title.textContent=a.email || "No email";
    const meta=document.createElement("small"); meta.textContent=`Role: ${a.role || "normal"} · Permissions: ${Object.keys(a.permissions||{}).filter(k=>a.permissions[k]).join(", ")||"none"}`;
    el.append(title,meta);
    if(window.scalegridAdmin?.role==="super"){
      const del=document.createElement("button"); del.className="btn-secondary"; del.textContent="Delete";
      del.onclick=()=>window.deleteAdmin(id); el.append(del);
    }
    (a.role==="super"?$("superAdminsList"):$("normalAdminsList")).append(el);
  });
  if(!$("superAdminsList").children.length)$("superAdminsList").textContent="No super admins.";
  if(!$("normalAdminsList").children.length)$("normalAdminsList").textContent="No normal admins.";
};
window.addSuperAdmin=()=>addAdmin("super");
window.addNormalAdmin=()=>addAdmin("normal");
async function addAdmin(role){
  if(window.scalegridAdmin?.role!=="super")return notify("Only super admins can manage administrators.");
  const email=prompt(`Enter ${role} admin email:`)?.trim().toLowerCase(); if(!email)return;
  await set(push(ref(database,"admins")),{email,role,permissions:role==="super"?{content:true,portfolio:true,faqs:true,pricing:true,sections:true}:{content:true,portfolio:true,faqs:true}});
  window.loadAdminUsers();
}
window.deleteAdmin=async id=>{
  if(window.scalegridAdmin?.role!=="super")return notify("Only super admins can remove administrators.");
  if(confirm("Remove this admin?")){await remove(ref(database,`admins/${id}`));window.loadAdminUsers();}
};
window.openPermissionsModal=async(id,email)=>{
  currentEditingAdminId=id; if($("modalAdminEmail"))$("modalAdminEmail").textContent=`Permissions for ${email}`;
  if($("permissionsModal"))$("permissionsModal").style.display="flex";
  const snap=await get(ref(database,`admins/${id}/permissions`));const perms=snap.val()||{};
  document.querySelectorAll("#permissionsListContainer input[data-perm]").forEach(c=>c.checked=!!perms[c.dataset.perm]);
};
window.closePermissionsModal=()=>{currentEditingAdminId=null;if($("permissionsModal"))$("permissionsModal").style.display="none";};
window.saveAdminPermissions=async()=>{
  if(!currentEditingAdminId || window.scalegridAdmin?.role!=="super")return;
  const perms={};document.querySelectorAll("#permissionsListContainer input[data-perm]").forEach(c=>perms[c.dataset.perm]=c.checked);
  await set(ref(database,`admins/${currentEditingAdminId}/permissions`),perms);window.closePermissionsModal();window.loadAdminUsers();
};
window.addNewPermissionRule=()=>{
  const key=value("newPermissionKey").toLowerCase().replace(/\s+/g,"_");if(!key)return;
  const label=document.createElement("label");const input=document.createElement("input");input.type="checkbox";input.dataset.perm=key;input.checked=true;
  label.append(input,document.createTextNode(` ${key}`));$("permissionsListContainer")?.append(label);$("newPermissionKey").value="";
};

// Notification management: existing notifications/<push-key> schema is preserved.
window.sendNotification=async()=>{
  const title=value("noticeTitle"), message=value("noticeMessage");
  if(!title||!message)return notify("Please enter a notification title and message.");
  await push(ref(database,"notifications"),{target:value("noticeTarget")||"General",title,bannerUrl:value("noticeBannerUrl"),message,timestamp:new Date().toISOString()});
  ["noticeTitle","noticeBannerUrl","noticeMessage"].forEach(id=>{if($(id))$(id).value=""});
  notify("Notification published.");
};
async function loadNotifications(){
  const snap=await get(ref(database,"notifications"));const rows=snap.exists()?Object.entries(snap.val()).reverse():[];
  $("notificationsList").innerHTML="";
  rows.forEach(([id,n])=>{const row=document.createElement("div");row.className="notification-row";const t=document.createElement("strong");t.textContent=n.title||"Notification";const p=document.createElement("p");p.textContent=n.message||"";const b=document.createElement("button");b.textContent="Delete";b.className="btn-secondary";b.onclick=async()=>{if(confirm("Delete notification?")){await remove(ref(database,`notifications/${id}`));loadNotifications();}};row.append(t,p,b);$("notificationsList").append(row);});
}

// Page CMS
function pageRef(path=""){return ref(database,`pages/${pageKey}${path?"/"+path:""}`);}
async function loadPageSettings(){
  const snap=await get(pageRef());const d=snap.val()||{};
  if(d.hero){if($("heroVideoUrl"))$("heroVideoUrl").value=d.hero.heroUrl||"";if($("displayHeroVideo"))$("displayHeroVideo").checked=d.hero.displayHero!==false;}
  if(d.description){if($("serviceHeadline"))$("serviceHeadline").value=d.description.headline||"";if($("serviceDescription"))$("serviceDescription").value=d.description.description||"";}
  const layout=d.layout||{};
  const names={hero:"Hero",description:"Desc",portfolio:"Portfolio",packages:"Packages",faqs:"Faqs"};
  Object.entries(names).forEach(([key,suffix])=>{if($(`order${suffix}`)&&layout[key])$(`order${suffix}`).value=layout[key].order||1;if($(`visible${suffix}`)&&layout[key])$(`visible${suffix}`).checked=layout[key].enabled!==false;});
  renderManagedList("portfolio", "managePortfolioList");
  renderManagedList("packages", "managePackageList");
  renderManagedList("faqs", "manageFaqList");
  if (pageKey === "general") {
    if ($("homeAbout")) $("homeAbout").value=d.about?.description||"";
    ["portfolio","faqs","testimonials","process"].forEach(type=>renderManagedList(type,`manageHome${type[0].toUpperCase()+type.slice(1)}`));
  }
}
window.saveHeroSettings=async()=>{
  await update(pageRef("hero"),{heroUrl:value("heroVideoUrl"),displayHero:checked("displayHeroVideo")});
  notify("Hero settings saved.");
};
window.saveServiceDescription=async()=>{
  const headline=value("serviceHeadline"),description=value("serviceDescription");
  await set(pageRef("description"),{headline,description});notify("Service description saved.");
};
window.saveSectionLayout=async()=>{
  const names={hero:"Hero",description:"Desc",portfolio:"Portfolio",packages:"Packages",faqs:"Faqs"};
  const layout={};Object.entries(names).forEach(([key,suffix])=>{layout[key]={order:Number($(`order${suffix}`)?.value)||1,enabled:$(`visible${suffix}`)?.checked!==false};});
  await set(pageRef("layout"),layout);notify("Section layout and visibility saved.");
};
window.addCustomLayoutSlot=async()=>{
  const name=value("newCustomSectionName");if(!name)return notify("Enter a section name.");
  const id=name.toLowerCase().replace(/[^a-z0-9]+/g,"_");
  await set(pageRef(`customSections/${id}`),{name,order:Number(value("newCustomSectionOrder"))||99,enabled:true});
  $("newCustomSectionName").value="";notify("Custom section slot saved.");
};
function formFor(type){
  const fields={
    portfolio: pageKey==="ads"?["portfolioTitle","portfolioImage","portfolioLink"]:pageKey==="apps"?["appName","appIcon","appDownloadLink"]:pageKey==="websites"?["siteName","siteImage","siteUrl"]:["autoTitle","autoImage","autoWebhook"],
    packages:["packageName","packagePrice","packageBullets","packageOrderLink"],
    faqs:["faqQuestion","faqAnswer"]
  };
  return fields[type]||[];
}
window.addPortfolioItem=()=>saveManagedItem("portfolio");
window.addAppItem=()=>saveManagedItem("portfolio");
window.addWebsite=()=>saveManagedItem("portfolio");
window.addAutomation=()=>saveManagedItem("portfolio");
window.addPackageItem=()=>saveManagedItem("packages");
window.addFaqItem=()=>saveManagedItem("faqs");
async function saveManagedItem(type){
  const ids=formFor(type);const vals=ids.map(value);
  if(vals.every(v=>!v))return notify("Enter the item details first.");
  const obj=type==="portfolio"?{title:vals[0],image:vals[1]||"",link:vals[2]||"",description:"",enabled:true}
    :type==="packages"?{name:vals[0],price:vals[1],bullets:vals[2],orderLink:vals[3]||"",enabled:true}
    :{question:vals[0],answer:vals[1],enabled:true};
  if((type==="faqs"&&(!obj.question||!obj.answer))||(type==="packages"&&!obj.name)||(type==="portfolio"&&!obj.title))return notify("Please complete the required title/name and description fields.");
  await push(pageRef(type),obj);
  ids.forEach(id=>{if($(id))$(id).value=""});
  renderManagedList(type,type==="portfolio"?"managePortfolioList":type==="packages"?"managePackageList":"manageFaqList");
  notify("Item saved and published.");
}
async function renderManagedList(type,id){
  const target=$(id);if(!target)return;
  const snap=await get(pageRef(type));const rows=snap.exists()?Object.entries(snap.val()):[];
  target.innerHTML="";
  rows.forEach(([key,item])=>{
    const row=document.createElement("div");row.className="managed-item-row";
    const label=document.createElement("span");label.textContent=item.title||item.name||item.question||"Item";
    const del=document.createElement("button");del.className="btn-secondary";del.textContent="Delete";
    del.onclick=async()=>{if(confirm("Delete this item?")){await remove(pageRef(`${type}/${key}`));renderManagedList(type,id);}};
    row.append(label,del);target.append(row);
  });
  if(!rows.length)target.textContent="No items published yet.";
}

window.saveHomeAbout=async()=>{
  const description=value("homeAbout"); if(!description)return notify("Enter the About text.");
  await set(pageRef("about"),{description,enabled:true});notify("Homepage About content saved.");
};
window.addHomePortfolio=async()=>{
  const title=value("homePortfolioTitle"),description=value("homePortfolioDescription"),image=value("homePortfolioImage"),link=value("homePortfolioLink");
  if(!title||!description)return notify("Enter a project title and description.");
  await push(pageRef("portfolio"),{title,description,image,link,enabled:true});
  ["homePortfolioTitle","homePortfolioDescription","homePortfolioImage","homePortfolioLink"].forEach(id=>$(id).value="");
  renderManagedList("portfolio","manageHomePortfolio");notify("Homepage portfolio item published.");
};
window.addHomeTestimonial=async()=>{
  const quote=value("testimonialQuote"),name=value("testimonialName"),role=value("testimonialRole");
  if(!quote||!name)return notify("Enter a testimonial and client name.");
  await push(pageRef("testimonials"),{quote,name,role,enabled:true});
  ["testimonialQuote","testimonialName","testimonialRole"].forEach(id=>$(id).value="");
  renderManagedList("testimonials","manageHomeTestimonials");notify("Testimonial published.");
};
window.addHomeProcess=async()=>{
  const step=value("processStep"),description=value("processDescription");
  if(!step||!description)return notify("Enter a step title and description.");
  await push(pageRef("process"),{step,description,enabled:true});
  ["processStep","processDescription"].forEach(id=>$(id).value="");
  renderManagedList("process","manageHomeProcess");notify("Process step published.");
};
window.addHomeFaq=async()=>{
  const question=value("homeFaqQuestion"),answer=value("homeFaqAnswer");
  if(!question||!answer)return notify("Enter both question and answer.");
  await push(pageRef("faqs"),{question,answer,enabled:true});
  ["homeFaqQuestion","homeFaqAnswer"].forEach(id=>$(id).value="");
  renderManagedList("faqs","manageHomeFaqs");notify("Homepage FAQ published.");
};
