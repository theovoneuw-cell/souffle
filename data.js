/* Souffle — contenu : étapes du corps, missions, techniques, déclencheurs, trophées. */
"use strict";

const MIN = 60e3, HOUR = 36e5, DAY = 864e5;

/* Repères OMS / Tabac Info Service */
const MILESTONES = [
  [20*MIN,"20 min","Ton cœur ralentit","La tension et le pouls redescendent vers la normale.","heart"],
  [8*HOUR,"8 h","L'oxygène revient","Le monoxyde de carbone dans ton sang a diminué de moitié ; l'oxygène se normalise.","drop"],
  [24*HOUR,"24 h","Monoxyde de carbone éliminé","Il a quitté ton corps. Tes poumons commencent à évacuer les résidus.","wind"],
  [48*HOUR,"48 h","Goût et odorat","Plus de nicotine dans le sang. Le goût et l'odorat se réveillent.","sparkle"],
  [72*HOUR,"72 h","Tu respires mieux","Les bronches se relâchent, respirer demande moins d'effort. C'est souvent le pic du manque : tiens bon.","lungs"],
  [14*DAY,"2 semaines","Circulation","La circulation s'améliore ; marcher et monter les escaliers devient plus facile.","walk"],
  [30*DAY,"1 mois","Moins de toux","La toux et la fatigue reculent, les cils bronchiques repoussent.","leaf"],
  [90*DAY,"3 mois","Capacité pulmonaire","Ta fonction respiratoire peut avoir progressé jusqu'à 30 %.","chart"],
  [365*DAY,"1 an","Cœur protégé","Le risque d'infarctus est divisé par deux.","shield"],
  [5*365*DAY,"5 ans","Cerveau protégé","Le risque d'AVC se rapproche de celui d'un non-fumeur.","brain"],
  [10*365*DAY,"10 ans","Poumons","Le risque de cancer du poumon est divisé par deux.","lungs"],
  [15*365*DAY,"15 ans","Comme un non-fumeur","Ton risque cardiovasculaire rejoint celui d'une personne qui n'a jamais fumé.","star"],
].map(([after,label,title,detail,icon],id)=>({id,after,label,title,detail,icon}));

/* Programme de 30 jours — une action concrète par jour (approche TCC). */
const MISSIONS = [
  ["Fais le vide","Jette cigarettes, briquets et cendriers. Pas de « paquet de secours » : il finit toujours par servir."],
  ["Préviens trois personnes","Dis à trois proches que tu as arrêté. Demande-leur de ne pas te proposer de cigarette."],
  ["Repère tes moments","Note chaque envie dans le journal aujourd'hui, avec son déclencheur. C'est la base de tes stats."],
  ["Ton plan B","Choisis ce que tu feras à la prochaine envie : respirer, marcher, boire un verre d'eau. Teste-le une fois."],
  ["Change le café","Si café = clope, change de rituel : autre tasse, autre endroit, ou un thé pendant une semaine."],
  ["Bouge 20 minutes","Une marche rapide fait baisser l'envie de fumer, et l'effet dure un moment. Fais-en une aujourd'hui."],
  ["Une semaine !","Regarde ton argent économisé et choisis ce que tu t'offres à 1 mois."],
  ["Les mains occupées","Prépare quelque chose à manipuler : stylo, élastique, balle anti-stress, bâton de réglisse."],
  ["La phrase-réflexe","Écris une phrase à te répéter quand l'envie arrive. Ajoute-la à tes raisons dans l'onglet Toi."],
  ["Surfe une envie","À la prochaine envie, ouvre le SOS et choisis « Surfer l'envie ». Observe-la monter puis redescendre."],
  ["Évite un piège","Identifie la situation la plus risquée de ta semaine et prévois comment l'éviter ou la traverser."],
  ["Nettoie l'odeur","Lave une veste, aère la voiture ou la chambre. Ton odorat est revenu : profite-en."],
  ["Hydrate-toi","Bois 1,5 L d'eau aujourd'hui. Ça aide à passer les envies et à éliminer."],
  ["Deux semaines","Note un truc qui va mieux depuis l'arrêt (souffle, goût, sommeil, argent…). Garde-le dans tes raisons."],
  ["Les soirées","Prépare ta prochaine soirée : boisson sans alcool sous la main, rester avec les non-fumeurs, sortir prendre l'air autrement."],
  ["Respire en musique","Fais 5 minutes de respiration lente sur un morceau calme. C'est ton nouveau « moment pause »."],
  ["Le stress autrement","Liste trois façons de te détendre qui ne sont pas la cigarette. Utilise-en une aujourd'hui."],
  ["Récompense-toi","Offre-toi un petit plaisir avec une partie de l'argent économisé. Tu l'as gagné."],
  ["Revois tes stats","Va dans l'onglet Stats : quelle heure, quel déclencheur reviennent le plus ? Adapte ton plan."],
  ["Sommeil","Pas d'écran 30 min avant de dormir ce soir. Le sommeil est souvent perturbé les premières semaines : aide-le."],
  ["Trois semaines","Les envies sont moins fréquentes. Regarde la courbe dans Stats : c'est la preuve."],
  ["Mange malin","Garde des en-cas sains à portée (fruits, crudités, noix) pour éviter de compenser par le sucre."],
  ["Aide quelqu'un","Raconte ton arrêt à quelqu'un qui veut arrêter. Expliquer, c'est se renforcer."],
  ["Ne joue pas","« Juste une » n'existe pas : écris pourquoi une seule cigarette relancerait tout. Relis-le si besoin."],
  ["Bouge plus","Monte d'un cran : 30 minutes d'activité. Regarde ton pouls au repos dans l'onglet Santé."],
  ["Nouvelle identité","Dis « je ne fume pas » plutôt que « j'essaie d'arrêter ». Tu es non-fumeur."],
  ["Les photos","Prends une photo de toi aujourd'hui. Dans un an, compare."],
  ["Prépare l'après","Choisis comment tu réagiras si un jour tu craques : un faux pas n'est pas une rechute."],
  ["Remercie-toi","Écris un message à toi-même dans un mois. Mets-le dans tes raisons."],
  ["Un mois !","Partage ta carte de progrès depuis l'onglet Progrès. 30 jours, c'est énorme."],
].map(([title,text],i)=>({day:i+1,title,text}));

/* Techniques anti-envie (validées : 4D, urge surfing, distraction, etc.) */
const TECHNIQUES = [
  ["Retarde","Dis-toi : « j'attends 5 minutes ». L'envie culmine puis redescend presque toujours avant."],
  ["Respire lentement","Inspire 4 s, bloque 4 s, expire 6 s. L'expiration longue calme le système nerveux."],
  ["Bois de l'eau froide","Un grand verre, à petites gorgées. Ça occupe la bouche et les mains."],
  ["Change d'endroit","Lève-toi, sors de la pièce. L'envie est souvent liée au lieu."],
  ["Marche 5 minutes","Même courte, l'activité physique réduit l'envie et l'irritabilité."],
  ["Occupe tes mains","Stylo, élastique, téléphone, réglisse : donne-leur autre chose à faire."],
  ["Appelle quelqu'un","Parler 2 minutes suffit souvent à faire passer le pic."],
  ["Brosse-toi les dents","Le goût frais rend la cigarette beaucoup moins attirante."],
  ["Mâche quelque chose","Chewing-gum sans sucre, carotte, noix : la mastication aide."],
  ["Relis tes raisons","Pourquoi tu as arrêté. Lis-les à voix haute si tu peux."],
  ["Compte à rebours","Compte lentement de 100 à 0 de 3 en 3. Ton cerveau ne peut pas penser à deux choses."],
  ["Douche ou eau froide","De l'eau froide sur le visage et les poignets coupe l'envie net."],
  ["Visualise","Imagine-toi dans 3 mois : plus de souffle, plus d'argent, plus libre."],
  ["Nomme l'envie","Dis : « c'est juste une envie, elle va passer ». La nommer lui enlève du pouvoir."],
  ["Substitut","Si tu utilises des substituts, c'est le moment : une gomme ou une pastille."],
  ["Note-la","Ouvre le journal et note l'envie : déclencheur, intensité. Comprendre, c'est désamorcer."],
].map(([title,text])=>({title,text}));

const TRIGGERS = [
  ["cafe","Café"],["stress","Stress"],["repas","Après manger"],["alcool","Alcool"],["ennui","Ennui"],
  ["pause","Pause"],["social","Avec des fumeurs"],["voiture","Voiture"],["reveil","Réveil"],["telephone","Téléphone"],
  ["fatigue","Fatigue"],["colere","Colère"],["autre","Autre"],
];
const TRIGGER_LABEL = Object.fromEntries(TRIGGERS);

const SUBSTITUTES = [["patch","Patch"],["gomme","Gomme"],["pastille","Pastille"],["spray","Spray"],["vape","Vape"],["inhaleur","Inhaleur"]];
const SUB_LABEL = Object.fromEntries(SUBSTITUTES);

/* Trophées. kind: time (ms) | money (€) | cigs | resisted | missions | sync */
const BADGES = (()=>{
  const b=[];
  const t=[[HOUR,"1 heure"],[6*HOUR,"6 heures"],[12*HOUR,"12 heures"],[DAY,"1 jour"],[2*DAY,"2 jours"],[3*DAY,"3 jours"],[5*DAY,"5 jours"],
    [7*DAY,"1 semaine"],[10*DAY,"10 jours"],[14*DAY,"2 semaines"],[21*DAY,"3 semaines"],[30*DAY,"1 mois"],[45*DAY,"45 jours"],[60*DAY,"2 mois"],
    [90*DAY,"3 mois"],[100*DAY,"100 jours"],[180*DAY,"6 mois"],[270*DAY,"9 mois"],[365*DAY,"1 an"],[500*DAY,"500 jours"],[730*DAY,"2 ans"],[1095*DAY,"3 ans"],[1825*DAY,"5 ans"],[3650*DAY,"10 ans"]];
  t.forEach(([v,l])=>b.push({id:"t"+v,kind:"time",v,title:l,sub:"sans fumer",icon:"clock"}));
  [10,25,50,100,200,300,500,750,1000,2000,3000,5000,10000].forEach(v=>b.push({id:"m"+v,kind:"money",v,title:v.toLocaleString("fr-FR")+" €",sub:"économisés",icon:"coin"}));
  [20,50,100,200,365,500,1000,2000,5000,10000,20000].forEach(v=>b.push({id:"c"+v,kind:"cigs",v,title:v.toLocaleString("fr-FR"),sub:v===20?"cigarettes, 1 paquet":"cigarettes évitées",icon:"nocig"}));
  [1,3,5,10,25,50,100,250].forEach(v=>b.push({id:"r"+v,kind:"resisted",v,title:v===1?"1re envie":v+" envies",sub:"vaincues",icon:"flame"}));
  [1,7,14,21,30].forEach(v=>b.push({id:"q"+v,kind:"missions",v,title:v===1?"1re mission":v+" missions",sub:"du programme",icon:"check"}));
  b.push({id:"s1",kind:"sync",v:1,title:"Montre reliée",sub:"1re synchro Santé",icon:"watch"});
  b.push({id:"s7",kind:"sync",v:7,title:"7 jours de données",sub:"Apple Watch",icon:"watch"});
  return b;
})();

/* Icônes (traits 1.8, 24×24) */
const ICON = {
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  drop:'<path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z"/>',
  wind:'<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
  sparkle:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  lungs:'<path d="M12 4v8m0 0-3-2M12 12l3-2M8.5 7C5.5 7 4 11 4 15c0 2.5 1 4 3 4s3-1.5 3-4V9.5M15.5 7c3 0 4.5 4 4.5 8 0 2.5-1 4-3 4s-3-1.5-3-4V9.5"/>',
  walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-6.5L14 17v4M7 12l3-4.5 4 1.5 2 3.5M11.5 14.5 10 8"/>',
  leaf:'<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  chart:'<path d="M4 20V4M4 20h16M8 16l4-5 3 3 4-6"/>',
  shield:'<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3z"/><path d="m9 12 2 2 4-4"/>',
  brain:'<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10.3 3 3 0 0 0 5 15a3 3 0 0 0 4 4.5V4zM15 4a3 3 0 0 1 3 3v.5a3 3 0 0 1 2 2.8 3 3 0 0 1-1 4.7 3 3 0 0 1-4 4.5V4z"/>',
  star:'<path d="m12 3.5 2.6 5.5 6 .8-4.4 4.1 1.1 5.9L12 17l-5.3 2.8 1.1-5.9L3.4 9.8l6-.8z"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  coin:'<circle cx="12" cy="12" r="8.5"/><path d="M15 9.2a3.4 3.4 0 1 0 0 5.6M8 11h5.5M8 13.2h5"/>',
  nocig:'<path d="M3 14h13v3H3zM19 14v3M21.5 14v3M18 7c0 2 2.5 2 2.5 4M4 4l16 16"/>',
  flame:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.5-4.6.2 1.6 1 2.6 2 3.1C11 9 11.5 6 12 3z"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  watch:'<rect x="6" y="5" width="12" height="14" rx="3.5"/><path d="M9 5V2.5h6V5M9 19v2.5h6V19M9 12h1.5l1-2 1.5 4 1-2H15"/>',
  today:'<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>',
  stats:'<path d="M5 20v-7M12 20V5M19 20v-10"/>',
  trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  phone:'<path d="M6.5 3.5h3l1.5 4-2 1.3a10 10 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>',
  gift:'<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18v-1.5H3zM12 7.5V20M12 7.5S10.5 3.5 8 4.5 9.5 7.5 12 7.5zM12 7.5s1.5-4 4-3-1.5 3-4 3"/>',
  share:'<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12"/>',
  trash:'<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  pill:'<rect x="3.5" y="8.5" width="17" height="7" rx="3.5"/><path d="M12 8.5v7"/>',
  cig:'<path d="M3 14h13v3H3zM19 14v3M21.5 14v3M18 7c0 2 2.5 2 2.5 4"/>',
  game:'<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="7" r="2"/><circle cx="15" cy="15.5" r="3.5"/>',
  wave:'<path d="M3 15c3 0 3-6 6-6s3 6 6 6 3-6 6-6"/>',
  bulb:'<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  download:'<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>',
  upload:'<path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14"/>',
  chevron:'<path d="m9 6 6 6-6 6"/>',
  note:'<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>',
};
function icon(name, size=22, extra=""){
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICON[name]||""}</svg>`;
}

/* ============================================================
   Coach anti-envie — approche des tabacologues :
   évaluer, identifier le déclencheur, recadrer la pensée (TCC),
   raviver la motivation (entretien motivationnel), agir, réévaluer.
   ============================================================ */
const INTENSITY_LABEL = {1:"Légère",2:"Moyenne",3:"Forte",4:"Très forte",5:"Insupportable"};

/* Pour chaque déclencheur : ce qui se passe, et l'action pendant le minuteur. */
const TRIGGER_COACH = {
  cafe:{why:"Café et cigarette sont devenus un duo dans ton cerveau : l'un appelle l'autre. On casse l'association.", act:"Change de place, garde l'autre main occupée, et bois ton café plus vite que d'habitude."},
  stress:{why:"Le stress pousse vers la cigarette parce qu'elle calmait le manque de nicotine, pas le stress lui-même. On calme ton corps directement.", act:"Épaules relâchées, inspire 4 secondes, bloque 4, expire 6. Recommence jusqu'à la fin du minuteur."},
  repas:{why:"Après manger, c'est un des moments les plus automatiques. Le geste arrive avant la réflexion.", act:"Lève-toi de table. Brosse-toi les dents ou prends un chewing-gum à la menthe : le goût frais coupe l'envie."},
  alcool:{why:"L'alcool baisse la vigilance : c'est là qu'arrivent beaucoup de faux pas. Ce n'est pas un manque de volonté, c'est chimique.", act:"Pose ton verre quelques minutes, prends un verre d'eau, et éloigne-toi des fumeurs."},
  ennui:{why:"L'ennui laisse toute la place à l'envie. Il te faut quelque chose de court et prenant.", act:"Marche, envoie un message à quelqu'un, range un truc. N'importe quoi qui occupe tes mains et ta tête."},
  pause:{why:"La pause cigarette, c'était ton moment à toi. Tu as le droit de garder la pause : on change juste ce qu'il y a dedans.", act:"Sors prendre l'air sans cigarette. Marche jusqu'au coin de la rue et reviens."},
  social:{why:"Avec des fumeurs, l'envie vient par imitation. Ton cerveau voit le geste et le réclame.", act:"Mets-toi un peu à l'écart pendant qu'ils fument, occupe tes mains. « J'ai arrêté » suffit, pas besoin de te justifier."},
  voiture:{why:"En voiture, mains et bouche sont libres et le trajet est long : terrain idéal pour l'automatisme.", act:"Mets une musique que tu aimes fort, mâche un chewing-gum, ouvre la fenêtre."},
  reveil:{why:"L'envie du réveil vient de la nuit sans nicotine. Elle est forte mais courte.", act:"Grand verre d'eau froide, puis douche ou petit-déjeuner. Change l'ordre de ton matin."},
  telephone:{why:"Téléphone et cigarette, c'est un geste couplé : une main tient, l'autre cherche.", act:"Passe le téléphone dans l'autre main, ou marche pendant l'appel."},
  fatigue:{why:"Fatigué, on a moins de ressources pour résister. Ce n'est pas le moment de décider quoi que ce soit.", act:"Eau froide sur le visage et les poignets, puis quelques respirations lentes."},
  colere:{why:"La colère cherche une sortie. La cigarette ne règle rien à la situation, elle la met juste en pause cinq minutes.", act:"Marche vite, serre quelque chose fort, ou écris ce qui t'énerve."},
  autre:{why:"Pas besoin de savoir d'où elle vient pour la laisser passer. On s'occupe de ton corps d'abord.", act:"Un grand verre d'eau froide, à petites gorgées, et respire lentement."},
};

/* Pensées automatiques et recadrage (thérapie cognitive). {days} {money} {resisted} {years} {one} {many} remplacés. */
const THOUGHTS = [
  ["juste1","« Juste une, ça ne compte pas »",[
    "C'est la pensée la plus piégeuse, et ton cerveau la connaît par cœur.",
    "Pour lui, il n'y a pas « une » {one} : il y a la première d'une nouvelle série. Une seule suffit à relancer le manque pour plusieurs jours.",
    "Tu ne refuses pas une {one}. Tu protèges {dur} sans tabac."]],
  ["calme","« J'en ai besoin pour me calmer »",[
    "Je comprends. Mais la cigarette calmait surtout le manque qu'elle créait elle-même.",
    "Les études le montrent : une fois le sevrage passé, le stress et l'anxiété baissent en moyenne chez les ex-fumeurs.",
    "Ton corps sait se calmer sans elle. On va le prouver dans deux minutes."]],
  ["echec","« Je ne vais pas y arriver »",[
    "Regarde les faits : {dur} sans fumer{resisted}. Tu y arrives, là, maintenant.",
    "Tu n'as pas à tenir pour toujours. Juste les cinq prochaines minutes."]],
  ["manque","« Ça me manque, tout simplement »",[
    "C'est normal : {years} ans d'habitude, ça laisse une trace.",
    "Ce qui te manque, c'est surtout le rituel, la pause, le geste. Pas la fumée. On peut garder le rituel et retirer la {one}."]],
  ["plaisir","« Je mérite un petit plaisir »",[
    "Tu as raison de vouloir te faire du bien. Tu le mérites vraiment.",
    "Tu as déjà gardé {money}. Offre-toi un vrai plaisir avec : celui-là ne te coûtera rien en santé."]],
  ["rien","Rien de précis",[
    "D'accord. Parfois c'est juste le corps qui réclame, sans raison.",
    "Pas besoin de discuter avec l'envie. On la regarde passer."]],
];

/* Deuxième outil quand l'envie résiste. */
const SECOND_TOOLS = [
  ["surf","Surfer l'envie","On change d'approche : au lieu de lutter, on observe. Je te guide."],
  ["game","Jouer une minute","On occupe ton cerveau à fond. Touche les nuages, je reste là."],
  ["subst","Prendre un substitut","Si tu as une gomme, une pastille ou un spray, c'est le moment : ils agissent en quelques minutes. Prends-le, puis on refait le point."],
  ["call","Appeler quelqu'un","Appelle ou écris à quelqu'un, même pour parler d'autre chose. Deux minutes de conversation suffisent souvent à faire passer le pic."],
];
