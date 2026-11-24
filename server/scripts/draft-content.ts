// Builds DRAFT interpretation text for every content key in en, hi and gu, from classical significations:
// planet themes, sign qualities, house areas, dignity (exalted / own / debilitated) and house type
// (kendra, trikona, dusthana, upachaya). Output: content/drafts/<lang>.json, for astrologer review.
//
// These are drafts, not reviewed text (FR-16): import them only with a reviewer name that says so,
// and replace them with the astrologer's reviewed versions before going live.
//   bun server/scripts/draft-content.ts
import { CONTENT_KEYS, dignity, type GRAHAS, NAKSHATRAS, SIGNS } from "@jyotish/engine";
import en from "../../apps/web/messages/en.json";
import gu from "../../apps/web/messages/gu.json";
import hi from "../../apps/web/messages/hi.json";
import { AREA_HOUSE, LIFE } from "./draft-life";

type Lang = "en" | "hi" | "gu";
type Graha = (typeof GRAHAS)[number];
type Sign = (typeof SIGNS)[number];
type Nak = (typeof NAKSHATRAS)[number];
type Lord = "Ketu" | "Venus" | "Sun" | "Moon" | "Mars" | "Rahu" | "Jupiter" | "Saturn" | "Mercury";

const NAMES = { en, hi, gu };
const RULER: Record<Sign, Graha> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon", Leo: "Sun", Virgo: "Mercury",
  Libra: "Venus", Scorpio: "Mars", Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Saturn", Pisces: "Jupiter",
}; // biome-ignore format: table
const NAK_LORD: Lord[] = [
  "Ketu",
  "Venus",
  "Sun",
  "Moon",
  "Mars",
  "Rahu",
  "Jupiter",
  "Saturn",
  "Mercury",
];
const MALEFIC = new Set<Graha>(["Sun", "Mars", "Saturn", "Rahu", "Ketu"]);

interface Blocks {
  themes: Record<Graha, string>;
  qualities: Record<Sign, string>;
  area: string[]; // houses 1..12
  dignity: { exalted: string; own: string; debilitated: string };
  houseType: { lagna: string; kendra: string; trikona: string; dusthana: string; upachaya: string };
  nak: Record<Nak, string>;
  dasha: Record<Lord, string>;
  planetSign: string;
  planetHouse: string;
  lagna: string;
  moon: string;
  dashaText: string;
  ordinal: (n: number) => string;
}

const B: Record<Lang, Blocks> = {
  en: {
    themes: {
      Sun: "self, vitality, father, authority and recognition",
      Moon: "mind, emotions, mother, comfort and public life",
      Mars: "courage, drive, energy, property and siblings",
      Mercury: "intellect, speech, learning, trade and adaptability",
      Jupiter: "wisdom, faith, teachers, children and good fortune",
      Venus: "love, marriage, beauty, art and comforts",
      Saturn: "discipline, patience, hard work, service and longevity",
      Rahu: "ambition, the unconventional, foreign connections and sudden change",
      Ketu: "detachment, spirituality, past-life skills and inner insight",
    },
    qualities: {
      Aries: "bold, pioneering and quick to act",
      Taurus: "steady, patient and drawn to security and beauty",
      Gemini: "curious, communicative and versatile",
      Cancer: "caring, sensitive and protective of home and family",
      Leo: "confident, generous and ready to lead",
      Virgo: "careful, analytical and service-minded",
      Libra: "balanced, diplomatic and relationship-oriented",
      Scorpio: "intense, private and transformative",
      Sagittarius: "optimistic, principled and seeking higher knowledge",
      Capricorn: "practical, disciplined and ambitious",
      Aquarius: "independent, humanitarian and future-minded",
      Pisces: "compassionate, imaginative and spiritual",
    },
    area: [
      "the self, body, personality and the overall direction of life",
      "wealth, family, speech and food",
      "courage, siblings, communication and short journeys",
      "home, mother, property, vehicles and inner peace",
      "children, intelligence, creativity and past merit (purva punya)",
      "work, service, health, debts and overcoming rivals",
      "marriage, partnerships and dealings with others",
      "longevity, hidden matters, sudden events and inheritance",
      "fortune, dharma, father, teachers and long journeys",
      "career, status, reputation and your actions in the world",
      "gains, income, friends and the fulfilment of desires",
      "expenses, foreign lands, sleep, retreat and liberation",
    ],
    dignity: {
      exalted:
        "{planet} is exalted here, its strongest placement, so these matters tend to give their best results.",
      own: "{planet} is in its own sign here, comfortable and strong, so these matters are well supported.",
      debilitated:
        "{planet} is debilitated here, its weakest placement, so these matters need conscious effort; supportive factors elsewhere in the chart can lift it.",
    },
    houseType: {
      lagna:
        "The first house is both an angle and a house of fortune, so this planet colours your whole life.",
      kendra: "Angular houses give a planet strength and visibility.",
      trikona: "This is a house of fortune, which supports the planet's good results.",
      dusthana:
        "This is a house of challenge, so results tend to come through effort, service or inner change.",
      upachaya:
        "Natural malefics like {planet} often do well in this house of growth and improve with time.",
    },
    nak: {
      Ashwini: "quick, healing and pioneering; you like to start things and help others fast.",
      Bharani:
        "strong-willed and creative, able to carry heavy responsibilities and transformations.",
      Krittika: "sharp, purifying and determined; you cut through confusion and value honesty.",
      Rohini: "warm, attractive and creative, drawn to beauty, growth and comfort.",
      Mrigashira: "curious and searching, always exploring for something better.",
      Ardra: "intense and transformative; storms in life clear the way for renewal.",
      Punarvasu: "hopeful and resilient; after setbacks you return to goodness.",
      Pushya:
        "nurturing, dependable and protective; Pushya is one of the most auspicious nakshatras.",
      Ashlesha: "perceptive and intuitive, with a sharp, strategic mind.",
      Magha: "dignified, connected to ancestors and tradition, with natural authority.",
      PurvaPhalguni: "warm, creative and pleasure-loving, enjoying relationships and leisure.",
      UttaraPhalguni: "reliable and generous, valuing commitment, friendship and duty.",
      Hasta: "skilful and resourceful, good with your hands and practical tasks.",
      Chitra: "artistic and brilliant, drawn to design, form and making things beautiful.",
      Swati: "independent and flexible, like a young shoot in the wind; good at trade and balance.",
      Vishakha: "goal-driven and determined, pursuing aims with single-minded focus.",
      Anuradha: "devoted and friendly, building lasting bonds and succeeding through cooperation.",
      Jyeshtha: "protective and responsible, carrying seniority and the urge to lead.",
      Mula: "searching for roots and truth, ready to break down what is false.",
      PurvaAshadha: "confident and persuasive, with invincible enthusiasm.",
      UttaraAshadha: "principled and steady, winning lasting victories through right action.",
      Shravana: "a good listener and learner, valuing knowledge and connection.",
      Dhanishta: "rhythmic, prosperous and sociable, often musical or generous.",
      Shatabhisha: "independent and private, with healing ability and a scientific mind.",
      PurvaBhadrapada: "intense and idealistic, capable of deep commitment to a cause.",
      UttaraBhadrapada: "calm, wise and self-controlled, with depth and patience.",
      Revati: "gentle, nurturing and protective, guiding others safely on their journey.",
    },
    dasha: {
      Ketu: "A period of detachment, spiritual interest and letting go; sudden changes can redirect your path.",
      Venus: "A period for relationships, comfort, creativity and material growth.",
      Sun: "A period that emphasises career, authority, self-confidence and official matters.",
      Moon: "A period focused on emotions, family, home and public dealings; the mind seeks peace.",
      Mars: "A period of energy and action, good for property, courage and getting things done, with care around conflict.",
      Rahu: "A period of ambition and unconventional opportunities, often with foreign links or rapid change.",
      Jupiter:
        "A period of growth, learning, faith and good counsel; children and teachers may feature.",
      Saturn: "A period of steady effort and responsibility; patient work brings lasting results.",
      Mercury: "A period for learning, communication, business and intellectual work.",
    },
    planetSign:
      "With {planet} in {sign}, matters of {themes} are expressed in a way that is {qualities}. {dignity}",
    planetHouse:
      "With {planet} in the {ord} house, matters of {themes} show up mainly through {area}. {type}",
    lagna:
      "With {sign} rising, you come across as {qualities}. {ruler}, the lord of your lagna, is the key planet in your chart: its placement shows where your life energy goes.",
    moon: "With the Moon in {nak}, ruled by {lord}, your mind is {blurb} Your Vimshottari dasha sequence begins with {lord}.",
    dashaText:
      "{lord} mahadasha: {blurb} How {lord} is placed in your chart decides how these results come.",
    ordinal: (n) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`,
  },

  hi: {
    themes: {
      Sun: "आत्मविश्वास, जीवन-शक्ति, पिता, अधिकार और मान-सम्मान",
      Moon: "मन, भावनाएँ, माता, सुख और जनसंपर्क",
      Mars: "साहस, ऊर्जा, भूमि-संपत्ति और भाई-बहन",
      Mercury: "बुद्धि, वाणी, शिक्षा, व्यापार और चतुराई",
      Jupiter: "ज्ञान, आस्था, गुरु, संतान और सौभाग्य",
      Venus: "प्रेम, विवाह, सौंदर्य, कला और सुख-सुविधाएँ",
      Saturn: "अनुशासन, धैर्य, परिश्रम, सेवा और आयु",
      Rahu: "महत्वाकांक्षा, अपरंपरागत बातें, विदेश और अचानक परिवर्तन",
      Ketu: "वैराग्य, आध्यात्मिकता, पूर्वजन्म के कौशल और अंतर्ज्ञान",
    },
    qualities: {
      Aries: "साहसी, अग्रणी और तेज़",
      Taurus: "स्थिर, धैर्यवान और सुरक्षा व सौंदर्य-प्रिय",
      Gemini: "जिज्ञासु, संवादप्रिय और बहुमुखी",
      Cancer: "संवेदनशील, देखभाल करने वाले और परिवार-प्रिय",
      Leo: "आत्मविश्वासी, उदार और नेतृत्वकारी",
      Virgo: "सावधान, विश्लेषणात्मक और सेवाभावी",
      Libra: "संतुलित, कूटनीतिक और संबंध-प्रिय",
      Scorpio: "गहन, गोपनीय और परिवर्तनकारी",
      Sagittarius: "आशावादी, सिद्धांतवादी और ज्ञान-पिपासु",
      Capricorn: "व्यावहारिक, अनुशासित और महत्वाकांक्षी",
      Aquarius: "स्वतंत्र, मानवतावादी और दूरदर्शी",
      Pisces: "करुणामय, कल्पनाशील और आध्यात्मिक",
    },
    area: [
      "स्वयं, शरीर, व्यक्तित्व और जीवन की दिशा",
      "धन, परिवार, वाणी और भोजन",
      "साहस, भाई-बहन, संवाद और छोटी यात्राएँ",
      "घर, माता, संपत्ति, वाहन और मन की शांति",
      "संतान, बुद्धि, रचनात्मकता और पूर्व पुण्य",
      "काम, सेवा, स्वास्थ्य, ऋण और शत्रुओं पर विजय",
      "विवाह, साझेदारी और दूसरों से व्यवहार",
      "आयु, गुप्त बातें, अचानक घटनाएँ और विरासत",
      "भाग्य, धर्म, पिता, गुरु और लंबी यात्राएँ",
      "करियर, पद, प्रतिष्ठा और कर्म",
      "लाभ, आय, मित्र और इच्छा-पूर्ति",
      "खर्च, विदेश, नींद, एकांत और मोक्ष",
    ],
    dignity: {
      exalted: "{planet} यहाँ उच्च का है, यह इसकी सबसे बलवान स्थिति है, इसलिए ये विषय अच्छे फल देते हैं।",
      own: "{planet} यहाँ स्वराशि में है, सहज और बलवान, इसलिए इन विषयों को अच्छा सहारा मिलता है।",
      debilitated:
        "{planet} यहाँ नीच का है, यह इसकी सबसे कमज़ोर स्थिति है, इसलिए इन विषयों में सजग प्रयास चाहिए; कुंडली के अन्य शुभ योग इसे सँभाल सकते हैं।",
    },
    houseType: {
      lagna: "लग्न केंद्र और त्रिकोण दोनों है, इसलिए यहाँ ग्रह का प्रभाव पूरे जीवन पर दिखता है।",
      kendra: "केंद्र भाव ग्रह को बल और प्रत्यक्षता देता है।",
      trikona: "यह भाग्य का भाव है, जो ग्रह के शुभ फलों को सहारा देता है।",
      dusthana: "यह चुनौती का भाव है, इसलिए फल प्रयास, सेवा या आंतरिक परिवर्तन से आते हैं।",
      upachaya: "{planet} जैसे पाप ग्रह इस उपचय भाव में अक्सर अच्छे फल देते हैं और समय के साथ सुधरते हैं।",
    },
    nak: {
      Ashwini: "तेज़, उपचारक और अग्रणी है; आप काम जल्दी शुरू करना और दूसरों की तुरंत मदद करना पसंद करते हैं।",
      Bharani: "दृढ़ इच्छाशक्ति वाला और रचनात्मक है, बड़ी ज़िम्मेदारियाँ और परिवर्तन सँभालने में सक्षम।",
      Krittika: "तीक्ष्ण, शुद्ध करने वाला और दृढ़ है; आप भ्रम को काटते हैं और ईमानदारी को महत्व देते हैं।",
      Rohini: "स्नेही, आकर्षक और रचनात्मक है, सौंदर्य, विकास और सुख की ओर खिंचता है।",
      Mrigashira: "जिज्ञासु और खोजी है, हमेशा कुछ बेहतर की तलाश में रहता है।",
      Ardra: "गहन और परिवर्तनकारी है; जीवन के तूफ़ान नवीनीकरण का रास्ता साफ़ करते हैं।",
      Punarvasu: "आशावान और लचीला है; कठिनाइयों के बाद आप फिर से अच्छाई की ओर लौट आते हैं।",
      Pushya: "पोषण करने वाला, भरोसेमंद और रक्षक है; पुष्य सबसे शुभ नक्षत्रों में से एक है।",
      Ashlesha: "सूक्ष्मदर्शी और अंतर्ज्ञानी है, तीक्ष्ण और रणनीतिक बुद्धि के साथ।",
      Magha: "गरिमामय है, पूर्वजों और परंपरा से जुड़ा, स्वाभाविक अधिकार के साथ।",
      PurvaPhalguni: "स्नेही, रचनात्मक और आनंद-प्रिय है, संबंधों और विश्राम का आनंद लेता है।",
      UttaraPhalguni: "विश्वसनीय और उदार है, प्रतिबद्धता, मित्रता और कर्तव्य को महत्व देता है।",
      Hasta: "कुशल और साधन-संपन्न है, हाथ के काम और व्यावहारिक कार्यों में निपुण।",
      Chitra: "कलात्मक और प्रतिभाशाली है, रचना, रूप और सुंदरता गढ़ने की ओर आकर्षित।",
      Swati: "स्वतंत्र और लचीला है, हवा में झूलते नए अंकुर जैसा; व्यापार और संतुलन में कुशल।",
      Vishakha: "लक्ष्य-केंद्रित और दृढ़ है, एकाग्र होकर अपने उद्देश्यों का पीछा करता है।",
      Anuradha: "समर्पित और मैत्रीपूर्ण है, स्थायी संबंध बनाता है और सहयोग से सफल होता है।",
      Jyeshtha: "रक्षक और ज़िम्मेदार है, वरिष्ठता और नेतृत्व की इच्छा रखता है।",
      Mula: "जड़ों और सत्य की खोज में रहता है, जो झूठा है उसे तोड़ने को तैयार।",
      PurvaAshadha: "आत्मविश्वासी और प्रभावशाली है, अजेय उत्साह के साथ।",
      UttaraAshadha: "सिद्धांतवादी और स्थिर है, सही कर्म से स्थायी विजय पाता है।",
      Shravana: "अच्छा श्रोता और सीखने वाला है, ज्ञान और जुड़ाव को महत्व देता है।",
      Dhanishta: "लयबद्ध, समृद्ध और मिलनसार है, अक्सर संगीतप्रिय या उदार।",
      Shatabhisha: "स्वतंत्र और रहस्यप्रिय है, उपचार की क्षमता और वैज्ञानिक सोच के साथ।",
      PurvaBhadrapada: "गहन और आदर्शवादी है, किसी उद्देश्य के प्रति गहरी प्रतिबद्धता में सक्षम।",
      UttaraBhadrapada: "शांत, बुद्धिमान और संयमी है, गहराई और धैर्य के साथ।",
      Revati: "कोमल, पोषण करने वाला और रक्षक है, दूसरों को उनकी यात्रा में सुरक्षित मार्ग दिखाता है।",
    },
    dasha: {
      Ketu: "वैराग्य, आध्यात्मिक रुचि और छोड़ने का समय; अचानक परिवर्तन आपकी राह बदल सकते हैं।",
      Venus: "संबंधों, सुख, रचनात्मकता और भौतिक उन्नति का समय।",
      Sun: "करियर, अधिकार, आत्मविश्वास और सरकारी कामकाज पर ज़ोर का समय।",
      Moon: "भावनाओं, परिवार, घर और जनसंपर्क पर केंद्रित समय; मन शांति चाहता है।",
      Mars: "ऊर्जा और कर्म का समय; संपत्ति, साहस और काम पूरे करने के लिए अच्छा, पर विवादों से सावधान रहें।",
      Rahu: "महत्वाकांक्षा और अपरंपरागत अवसरों का समय, अक्सर विदेश से जुड़ाव या तेज़ बदलाव के साथ।",
      Jupiter: "विकास, ज्ञान, आस्था और अच्छे परामर्श का समय; संतान और गुरु महत्वपूर्ण हो सकते हैं।",
      Saturn: "स्थिर प्रयास और ज़िम्मेदारी का समय; धैर्यपूर्ण परिश्रम स्थायी फल देता है।",
      Mercury: "शिक्षा, संवाद, व्यापार और बौद्धिक कार्य का समय।",
    },
    planetSign:
      "{sign} राशि में {planet} होने से {themes} से जुड़े विषय {qualities} ढंग से प्रकट होते हैं। {dignity}",
    planetHouse:
      "भाव {ord} में {planet} होने से {themes} से जुड़े विषय मुख्य रूप से {area} के माध्यम से सामने आते हैं। {type}",
    lagna:
      "{sign} लग्न होने से आप {qualities} स्वभाव के दिखते हैं। लग्नेश {ruler} आपकी कुंडली का मुख्य ग्रह है: इसकी स्थिति बताती है कि आपकी जीवन-ऊर्जा किस ओर जाती है।",
    moon: "चंद्र {nak} नक्षत्र में है (स्वामी {lord}), इसलिए आपका मन {blurb} आपकी विंशोत्तरी दशा {lord} से शुरू होती है।",
    dashaText: "{lord} महादशा: {blurb} कुंडली में {lord} की स्थिति तय करती है कि ये फल कैसे मिलेंगे।",
    ordinal: (n) => String(n),
  },

  gu: {
    themes: {
      Sun: "આત્મવિશ્વાસ, જીવનશક્તિ, પિતા, અધિકાર અને માન-સન્માન",
      Moon: "મન, લાગણીઓ, માતા, સુખ અને જનસંપર્ક",
      Mars: "સાહસ, ઊર્જા, જમીન-મિલકત અને ભાઈ-બહેન",
      Mercury: "બુદ્ધિ, વાણી, શિક્ષણ, વેપાર અને ચતુરાઈ",
      Jupiter: "જ્ઞાન, શ્રદ્ધા, ગુરુ, સંતાન અને સૌભાગ્ય",
      Venus: "પ્રેમ, લગ્નજીવન, સૌંદર્ય, કલા અને સુખ-સગવડ",
      Saturn: "શિસ્ત, ધીરજ, પરિશ્રમ, સેવા અને આયુષ્ય",
      Rahu: "મહત્વાકાંક્ષા, અસામાન્ય બાબતો, વિદેશ અને અચાનક ફેરફાર",
      Ketu: "વૈરાગ્ય, આધ્યાત્મિકતા, પૂર્વજન્મની કુશળતા અને અંતઃસ્ફુરણા",
    },
    qualities: {
      Aries: "સાહસિક, અગ્રેસર અને ઝડપી",
      Taurus: "સ્થિર, ધીરજવાન અને સલામતી તથા સૌંદર્યપ્રિય",
      Gemini: "જિજ્ઞાસુ, વાતચીતમાં કુશળ અને બહુમુખી",
      Cancer: "લાગણીશીલ, કાળજી રાખનાર અને પરિવારપ્રેમી",
      Leo: "આત્મવિશ્વાસુ, ઉદાર અને નેતૃત્વ કરનાર",
      Virgo: "સાવચેત, વિશ્લેષણાત્મક અને સેવાભાવી",
      Libra: "સંતુલિત, વ્યવહારકુશળ અને સંબંધપ્રિય",
      Scorpio: "ઊંડા, ગુપ્ત અને પરિવર્તનકારી",
      Sagittarius: "આશાવાદી, સિદ્ધાંતવાદી અને જ્ઞાનપિપાસુ",
      Capricorn: "વ્યવહારુ, શિસ્તબદ્ધ અને મહત્વાકાંક્ષી",
      Aquarius: "સ્વતંત્ર, માનવતાવાદી અને દૂરંદેશી",
      Pisces: "દયાળુ, કલ્પનાશીલ અને આધ્યાત્મિક",
    },
    area: [
      "સ્વયં, શરીર, વ્યક્તિત્વ અને જીવનની દિશા",
      "ધન, કુટુંબ, વાણી અને ભોજન",
      "સાહસ, ભાઈ-બહેન, વાતચીત અને ટૂંકી યાત્રાઓ",
      "ઘર, માતા, મિલકત, વાહન અને મનની શાંતિ",
      "સંતાન, બુદ્ધિ, સર્જનાત્મકતા અને પૂર્વ પુણ્ય",
      "કામ, સેવા, આરોગ્ય, દેવું અને શત્રુઓ પર વિજય",
      "લગ્ન, ભાગીદારી અને બીજાઓ સાથેનો વ્યવહાર",
      "આયુષ્ય, ગુપ્ત બાબતો, અચાનક બનાવો અને વારસો",
      "ભાગ્ય, ધર્મ, પિતા, ગુરુ અને લાંબી યાત્રાઓ",
      "કારકિર્દી, પદ, પ્રતિષ્ઠા અને કર્મ",
      "લાભ, આવક, મિત્રો અને ઇચ્છાપૂર્તિ",
      "ખર્ચ, વિદેશ, ઊંઘ, એકાંત અને મોક્ષ",
    ],
    dignity: {
      exalted: "{planet} અહીં ઉચ્ચનો છે, આ તેની સૌથી બળવાન સ્થિતિ છે, તેથી આ બાબતો સારાં ફળ આપે છે.",
      own: "{planet} અહીં સ્વરાશિમાં છે, સહજ અને બળવાન, તેથી આ બાબતોને સારો ટેકો મળે છે.",
      debilitated:
        "{planet} અહીં નીચનો છે, આ તેની સૌથી નબળી સ્થિતિ છે, તેથી આ બાબતોમાં સભાન પ્રયત્ન જરૂરી છે; કુંડળીના અન્ય શુભ યોગ તેને સંભાળી શકે છે.",
    },
    houseType: {
      lagna: "લગ્ન કેન્દ્ર અને ત્રિકોણ બંને છે, તેથી અહીં ગ્રહની અસર આખા જીવન પર દેખાય છે.",
      kendra: "કેન્દ્ર ભાવ ગ્રહને બળ અને પ્રત્યક્ષતા આપે છે.",
      trikona: "આ ભાગ્યનો ભાવ છે, જે ગ્રહનાં શુભ ફળોને ટેકો આપે છે.",
      dusthana: "આ પડકારનો ભાવ છે, તેથી ફળ પ્રયત્ન, સેવા કે આંતરિક પરિવર્તનથી મળે છે.",
      upachaya: "{planet} જેવા પાપ ગ્રહ આ ઉપચય ભાવમાં ઘણીવાર સારાં ફળ આપે છે અને સમય સાથે સુધરે છે.",
    },
    nak: {
      Ashwini: "ઝડપી, ઉપચારક અને અગ્રેસર છે; તમને કામ ઝડપથી શરૂ કરવું અને બીજાને તરત મદદ કરવી ગમે છે.",
      Bharani: "દૃઢ ઇચ્છાશક્તિવાળું અને સર્જનાત્મક છે, મોટી જવાબદારીઓ અને પરિવર્તનો સંભાળવા સક્ષમ.",
      Krittika: "તીક્ષ્ણ, શુદ્ધ કરનારું અને દૃઢ છે; તમે ગૂંચવણ દૂર કરો છો અને પ્રામાણિકતાને મહત્વ આપો છો.",
      Rohini: "પ્રેમાળ, આકર્ષક અને સર્જનાત્મક છે, સૌંદર્ય, વિકાસ અને સુખ તરફ ખેંચાય છે.",
      Mrigashira: "જિજ્ઞાસુ અને શોધક છે, હંમેશાં કંઈક વધુ સારું શોધે છે.",
      Ardra: "ઊંડું અને પરિવર્તનકારી છે; જીવનનાં તોફાનો નવી શરૂઆતનો માર્ગ ખોલે છે.",
      Punarvasu: "આશાવાદી અને મજબૂત છે; મુશ્કેલીઓ પછી તમે ફરી સારપ તરફ પાછા વળો છો.",
      Pushya: "પોષણ આપનારું, ભરોસાપાત્ર અને રક્ષક છે; પુષ્ય સૌથી શુભ નક્ષત્રોમાંનું એક છે.",
      Ashlesha: "સૂક્ષ્મદર્શી અને અંતઃસ્ફુરણાવાળું છે, તીક્ષ્ણ અને વ્યૂહાત્મક બુદ્ધિ સાથે.",
      Magha: "ગૌરવશાળી છે, પૂર્વજો અને પરંપરા સાથે જોડાયેલું, સ્વાભાવિક અધિકાર સાથે.",
      PurvaPhalguni: "પ્રેમાળ, સર્જનાત્મક અને આનંદપ્રિય છે, સંબંધો અને આરામનો આનંદ માણે છે.",
      UttaraPhalguni: "વિશ્વસનીય અને ઉદાર છે, પ્રતિબદ્ધતા, મિત્રતા અને કર્તવ્યને મહત્વ આપે છે.",
      Hasta: "કુશળ અને સાધનસંપન્ન છે, હાથનાં કામ અને વ્યવહારુ કાર્યોમાં નિપુણ.",
      Chitra: "કલાત્મક અને પ્રતિભાશાળી છે, રચના, રૂપ અને સુંદરતા ઘડવા તરફ આકર્ષાય છે.",
      Swati: "સ્વતંત્ર અને લવચીક છે, પવનમાં ઝૂલતા નવા અંકુર જેવું; વેપાર અને સંતુલનમાં કુશળ.",
      Vishakha: "લક્ષ્યકેન્દ્રી અને દૃઢ છે, એકાગ્રતાથી પોતાના ઉદ્દેશો પાછળ જાય છે.",
      Anuradha: "સમર્પિત અને મૈત્રીપૂર્ણ છે, લાંબા સંબંધો બાંધે છે અને સહકારથી સફળ થાય છે.",
      Jyeshtha: "રક્ષક અને જવાબદાર છે, વડીલપણું અને નેતૃત્વની ઇચ્છા રાખે છે.",
      Mula: "મૂળ અને સત્યની શોધમાં રહે છે, જે ખોટું છે તેને તોડવા તૈયાર.",
      PurvaAshadha: "આત્મવિશ્વાસુ અને પ્રભાવશાળી છે, અજેય ઉત્સાહ સાથે.",
      UttaraAshadha: "સિદ્ધાંતવાદી અને સ્થિર છે, સાચાં કર્મોથી કાયમી વિજય મેળવે છે.",
      Shravana: "સારો શ્રોતા અને શીખનાર છે, જ્ઞાન અને સંબંધોને મહત્વ આપે છે.",
      Dhanishta: "લયબદ્ધ, સમૃદ્ધ અને મિલનસાર છે, ઘણીવાર સંગીતપ્રેમી કે ઉદાર.",
      Shatabhisha: "સ્વતંત્ર અને રહસ્યમય છે, ઉપચારની ક્ષમતા અને વૈજ્ઞાનિક વિચાર સાથે.",
      PurvaBhadrapada: "ઊંડું અને આદર્શવાદી છે, કોઈ ઉદ્દેશ પ્રત્યે ઊંડી પ્રતિબદ્ધતા રાખી શકે છે.",
      UttaraBhadrapada: "શાંત, જ્ઞાની અને સંયમી છે, ઊંડાણ અને ધીરજ સાથે.",
      Revati: "કોમળ, પોષણ આપનારું અને રક્ષક છે, બીજાઓને તેમની યાત્રામાં સુરક્ષિત માર્ગ બતાવે છે.",
    },
    dasha: {
      Ketu: "વૈરાગ્ય, આધ્યાત્મિક રુચિ અને છોડી દેવાનો સમય; અચાનક ફેરફારો તમારો માર્ગ બદલી શકે છે.",
      Venus: "સંબંધો, સુખ, સર્જનાત્મકતા અને ભૌતિક પ્રગતિનો સમય.",
      Sun: "કારકિર્દી, અધિકાર, આત્મવિશ્વાસ અને સરકારી કામકાજ પર ભારનો સમય.",
      Moon: "લાગણીઓ, કુટુંબ, ઘર અને જનસંપર્ક પર કેન્દ્રિત સમય; મન શાંતિ ઇચ્છે છે.",
      Mars: "ઊર્જા અને કર્મનો સમય; મિલકત, સાહસ અને કામ પૂરાં કરવા સારો, પણ વિવાદોથી સાવધ રહો.",
      Rahu: "મહત્વાકાંક્ષા અને અસામાન્ય તકોનો સમય, ઘણીવાર વિદેશ સાથેના સંબંધ કે ઝડપી ફેરફાર સાથે.",
      Jupiter: "વિકાસ, જ્ઞાન, શ્રદ્ધા અને સારી સલાહનો સમય; સંતાન અને ગુરુ મહત્વના બની શકે છે.",
      Saturn: "સ્થિર પ્રયત્ન અને જવાબદારીનો સમય; ધીરજપૂર્વકનો પરિશ્રમ કાયમી ફળ આપે છે.",
      Mercury: "શિક્ષણ, વાતચીત, વેપાર અને બૌદ્ધિક કાર્યનો સમય.",
    },
    planetSign:
      "{sign} રાશિમાં {planet} હોવાથી {themes} સંબંધિત બાબતો {qualities} રીતે વ્યક્ત થાય છે. {dignity}",
    planetHouse:
      "ભાવ {ord}માં {planet} હોવાથી {themes} સંબંધિત બાબતો મુખ્યત્વે {area} દ્વારા સામે આવે છે. {type}",
    lagna:
      "{sign} લગ્ન હોવાથી તમે {qualities} સ્વભાવના દેખાઓ છો. લગ્નેશ {ruler} તમારી કુંડળીનો મુખ્ય ગ્રહ છે: તેની સ્થિતિ બતાવે છે કે તમારી જીવનશક્તિ કઈ દિશામાં જાય છે.",
    moon: "ચંદ્ર {nak} નક્ષત્રમાં છે (સ્વામી {lord}), તેથી તમારું મન {blurb} તમારી વિંશોત્તરી દશા {lord}થી શરૂ થાય છે.",
    dashaText: "{lord} મહાદશા: {blurb} કુંડળીમાં {lord}ની સ્થિતિ નક્કી કરે છે કે આ ફળ કેવી રીતે મળશે.",
    ordinal: (n) => String(n),
  },
};

const fill = (tpl: string, vars: Record<string, string>) =>
  tpl
    .replace(/\{(\w+)\}/g, (_, k: string) => {
      if (!(k in vars)) throw new Error(`no value for {${k}} in "${tpl}"`);
      return vars[k]!;
    })
    .replace(/\s+/g, " ")
    .trim();

function houseType(b: Blocks, g: Graha, h: number, planet: string) {
  if (h === 1) return b.houseType.lagna;
  if (MALEFIC.has(g) && [3, 6, 10, 11].includes(h)) return fill(b.houseType.upachaya, { planet });
  if ([4, 7, 10].includes(h)) return b.houseType.kendra;
  if ([5, 9].includes(h)) return b.houseType.trikona;
  if ([6, 8, 12].includes(h)) return b.houseType.dusthana;
  return "";
}

/** Life-area keys: doshas, remedies, marriage, career, education, property, foreign, obstacles. */
function lifeText(lang: Lang, key: string): string {
  const L = LIFE[lang];
  const b = B[lang];
  const n = NAMES[lang];
  const planet = (g: string) => n.planets[g as Graha];
  const p = key.split(":");
  const [kind, a, c, d] = p as [string, string, string, string];
  const house = (h: string) => ({ ord: b.ordinal(Number(h)), area: b.area[Number(h) - 1]! });
  const karaka = (g: Graha, topic: keyof typeof L.topic, state: string) =>
    fill(L.karaka[state as "strong"], { planet: planet(g), topic: L.topic[topic] });
  switch (kind) {
    case "dosha":
      return L.dosha[a as keyof typeof L.dosha];
    case "remedy":
      return a === "dosha"
        ? L.remedyDosha[c as keyof typeof L.remedyDosha]
        : L.remedyPlanet[c as Graha];
    case "obstacle": {
      const area = a as keyof typeof AREA_HOUSE;
      return fill(L.obstacle[c as "malefic"], {
        n: String(AREA_HOUSE[area]),
        topic: L.areaTopic[area],
      });
    }
    case "marriage":
      if (a === "7th")
        return fill(L.marriage7Sign, {
          sign: n.signs[d as Sign],
          qualities: b.qualities[d as Sign],
        });
      if (a === "7lord") return fill(L.marriage7Lord, house(d));
      if (a === "in7")
        return fill(L.marriageIn7, { planet: planet(c), themes: b.themes[c as Graha] });
      return karaka("Venus", "marriage", c);
    case "career":
      if (a === "10th")
        return fill(L.career10Sign, {
          sign: n.signs[d as Sign],
          qualities: b.qualities[d as Sign],
        });
      if (a === "10lord") return fill(L.career10Lord, house(d));
      if (a === "in10")
        return fill(L.careerIn10, { planet: planet(c), themes: b.themes[c as Graha] });
      if (a === "field") return L.field[c as Graha];
      return L.mode[c as "job"];
    case "education":
      if (a === "5lord") return fill(L.edu5Lord, house(d));
      return a === "mercury"
        ? karaka("Mercury", "studyMercury", c)
        : karaka("Jupiter", "studyJupiter", c);
    case "property":
      if (a === "4lord") return fill(L.prop4Lord, house(d));
      return a === "venus" ? karaka("Venus", "vehicles", c) : karaka("Mars", "land", c);
    case "foreign":
      return a === "likely" ? L.foreignLikely[c as "high"] : L.foreignInd[c as "rahu"];
  }
  throw new Error(`unhandled key ${key}`);
}

export function draft(lang: Lang): Record<string, string> {
  const b = B[lang];
  const n = NAMES[lang];
  const planet = (g: Graha) => n.planets[g];
  const out: Record<string, string> = {};
  for (const key of CONTENT_KEYS) {
    const [kind, a, c, d] = key.split(":") as [string, string, string, string];
    if (kind === "lagna") {
      const s = c as Sign;
      out[key] = fill(b.lagna, {
        sign: n.signs[s],
        qualities: b.qualities[s],
        ruler: planet(RULER[s]),
      });
    } else if (kind === "planet" && c === "sign") {
      const g = a as Graha;
      const s = d as Sign;
      const dig = dignity(g, SIGNS.indexOf(s));
      out[key] = fill(b.planetSign, {
        planet: planet(g),
        sign: n.signs[s],
        themes: b.themes[g],
        qualities: b.qualities[s],
        dignity: dig ? fill(b.dignity[dig], { planet: planet(g) }) : "",
      });
    } else if (kind === "planet" && c === "house") {
      const g = a as Graha;
      const h = Number(d);
      out[key] = fill(b.planetHouse, {
        planet: planet(g),
        ord: b.ordinal(h),
        themes: b.themes[g],
        area: b.area[h - 1]!,
        type: houseType(b, g, h, planet(g)),
      });
    } else if (kind === "moon") {
      const k = c as Nak;
      const lord = NAK_LORD[NAKSHATRAS.indexOf(k) % 9]!;
      out[key] = fill(b.moon, { nak: n.nakshatras[k], lord: planet(lord), blurb: b.nak[k] });
    } else if (kind === "dasha") {
      const l = a as Lord;
      out[key] = fill(b.dashaText, { lord: planet(l), blurb: b.dasha[l] });
    } else {
      out[key] = lifeText(lang, key);
    }
  }
  return out;
}

if (import.meta.main) {
  const dir = `${import.meta.dir}/../../content/drafts`;
  for (const lang of ["en", "hi", "gu"] as const) {
    await Bun.write(`${dir}/${lang}.json`, `${JSON.stringify(draft(lang), null, 2)}\n`);
    console.log(`content/drafts/${lang}.json: ${CONTENT_KEYS.length} entries`);
  }
}
