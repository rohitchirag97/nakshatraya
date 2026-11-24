// DRAFT text for the life-area keys (doshas, remedies, marriage, career, education, property, foreign)
// in en, hi and gu, for astrologer review. Remedies are mantra, daan, vrat and puja only (no gemstones).
import type { Graha } from "@jyotish/engine";

type Strength = "strong" | "weak" | "neutral";
type DoshaText =
  | "none"
  | "manglik"
  | "manglikCancelled"
  | "kaalsarp"
  | "sadesati"
  | "dhaiya"
  | "pitru"
  | "grahan"
  | "guruchandal"
  | "shrapit";
type DoshaRemedy = Exclude<DoshaText, "none" | "manglikCancelled">;
type Area = "marriage" | "career" | "education" | "property";
type Topic = "marriage" | "studyMercury" | "studyJupiter" | "vehicles" | "land";

export interface LifeBlocks {
  dosha: Record<DoshaText, string>;
  remedyDosha: Record<DoshaRemedy, string>;
  remedyPlanet: Record<Graha, string>;
  karaka: Record<Strength, string>; // {planet} {topic}
  topic: Record<Topic, string>;
  marriage7Sign: string; // {sign} {qualities}
  marriage7Lord: string; // {ord} {area}
  marriageIn7: string; // {planet} {themes}
  career10Sign: string;
  career10Lord: string;
  careerIn10: string;
  field: Record<Graha, string>;
  mode: Record<"job" | "business" | "both", string>;
  edu5Lord: string;
  prop4Lord: string;
  foreignLikely: Record<"high" | "medium" | "low", string>;
  foreignInd: Record<"rahu" | "lord12" | "lord9in12" | "moon12" | "lagnalord", string>;
  obstacle: Record<"malefic" | "lordDusthana", string>; // {n} {topic}
  areaTopic: Record<Area, string>;
}

export const LIFE: Record<"en" | "hi" | "gu", LifeBlocks> = {
  en: {
    dosha: {
      none: "No major dosha (Manglik, Kaal Sarp, Sade Sati, Pitru, Grahan, Guru Chandal or Shrapit) is found in this chart.",
      manglik:
        "Manglik (Mangal) dosha is present: Mars is in the 1st, 2nd, 4th, 7th, 8th or 12th house from the lagna. Traditionally this calls for careful matching in marriage, ideally with a partner whose chart also has Manglik dosha.",
      manglikCancelled:
        "Mars is in a Manglik position, but the dosha is cancelled (bhang): Mars is in its own or exalted sign, or receives Jupiter's influence. Its effect is greatly reduced.",
      kaalsarp:
        "Kaal Sarp dosha: all seven planets lie on one side of the Rahu–Ketu axis. It is linked with sudden ups and downs and delays that ease with steady effort.",
      sadesati:
        "Sade Sati is running: Saturn is transiting the 12th, 1st or 2nd sign from your Moon. This 7½-year period tests patience and brings responsibilities; disciplined work is rewarded.",
      dhaiya:
        "Shani Dhaiya (Kantak Shani) is running: Saturn is transiting the 4th or 8th sign from your Moon, a 2½-year period that asks for care with health, home and work.",
      pitru:
        "Pitru dosha: Rahu or Ketu is in the 9th house, or the Sun is joined with Rahu. Traditionally linked with ancestral debts; it can slow fortune and family matters.",
      grahan:
        "Grahan dosha: the Sun or Moon is joined with Rahu or Ketu. It can cloud confidence (Sun) or peace of mind (Moon) until it is steadied.",
      guruchandal:
        "Guru Chandal dosha: Jupiter is joined with Rahu. Judgement and the guidance of teachers may be tested; follow sound advice and ethics.",
      shrapit:
        "Shrapit dosha: Saturn is joined with Rahu. Efforts may feel blocked or slow to pay off; patience and service help.",
    },
    remedyDosha: {
      manglik:
        "Recite the Hanuman Chalisa on Tuesdays, give red lentils (masoor dal) in charity, and consider a Mangal Shanti puja. For marriage, Kumbh vivah or matching with a Manglik partner is the traditional remedy; decide with your astrologer.",
      kaalsarp:
        "Chant 'Om Namah Shivaya' daily, worship on Nag Panchami, and consider a Kaal Sarp dosha puja (for example at Trimbakeshwar) after consulting your astrologer.",
      sadesati:
        "On Saturdays recite the Hanuman Chalisa and the Shani mantra 'Om Sham Shanaishcharaya Namah', give mustard oil or black sesame in charity, and serve elders and workers.",
      dhaiya:
        "On Saturdays chant 'Om Sham Shanaishcharaya Namah', light a mustard-oil lamp under a peepal tree, and help those who labour.",
      pitru:
        "Perform shraddha and tarpan during Pitru Paksha, feed Brahmins, cows and crows, and consider Narayan Bali or Tripindi shraddha after consulting your astrologer.",
      grahan:
        "For the Sun, offer water to the rising Sun; for the Moon, worship Lord Shiva on Mondays; and give charity on eclipse days.",
      guruchandal:
        "Chant 'Om Brim Brihaspataye Namah' on Thursdays, respect teachers and elders, and give yellow items such as chana dal or turmeric in charity.",
      shrapit:
        "Chant the Mahamrityunjaya mantra, recite the Hanuman Chalisa on Saturdays, and consider a Shani–Rahu shanti puja after consulting your astrologer.",
    },
    remedyPlanet: {
      Sun: "For the Sun: offer water (arghya) to the rising Sun, chant 'Om Suryaya Namah', respect your father, and give wheat or jaggery on Sundays.",
      Moon: "For the Moon: chant 'Om Chandraya Namah', worship Lord Shiva on Mondays, keep a calm routine, and give milk or rice in charity.",
      Mars: "For Mars: recite the Hanuman Chalisa on Tuesdays, chant 'Om Mangalaya Namah', and give red lentils in charity.",
      Mercury:
        "For Mercury: chant 'Om Budhaya Namah' on Wednesdays, feed green fodder to cows, and give green moong in charity.",
      Jupiter:
        "For Jupiter: chant 'Om Brim Brihaspataye Namah' on Thursdays, respect teachers, and give chana dal or turmeric in charity.",
      Venus:
        "For Venus: chant 'Om Shukraya Namah' on Fridays, worship Goddess Lakshmi, and give white sweets, rice or clothes in charity.",
      Saturn:
        "For Saturn: chant 'Om Sham Shanaishcharaya Namah' on Saturdays, recite the Hanuman Chalisa, and give mustard oil or black sesame in charity.",
      Rahu: "For Rahu: chant 'Om Rahave Namah', worship Goddess Durga, and give blankets or black items in charity on Saturdays.",
      Ketu: "For Ketu: chant 'Om Ketave Namah', worship Lord Ganesha, and feed stray dogs.",
    },
    karaka: {
      strong:
        "{planet}, the karaka (significator) of {topic}, is strong in your chart (exalted or in its own sign): good support for {topic}.",
      weak: "{planet}, the karaka of {topic}, is weak in your chart (debilitated, combust or in a house of challenge), so {topic} may need more effort and patience.",
      neutral:
        "{planet}, the karaka of {topic}, is of average strength; results for {topic} follow the other factors described here.",
    },
    topic: {
      marriage: "marriage and relationships",
      studyMercury: "learning and intellect",
      studyJupiter: "higher education and wisdom",
      vehicles: "vehicles and comforts",
      land: "land and property",
    },
    marriage7Sign:
      "Your 7th house of marriage falls in {sign}: married life and the partner tend to be {qualities}.",
    marriage7Lord:
      "The lord of the 7th house sits in the {ord} house, linking marriage with {area}.",
    marriageIn7: "{planet} in the 7th house brings {themes} into marriage and partnerships.",
    career10Sign:
      "Your 10th house of career falls in {sign}: you work best in a way that is {qualities}.",
    career10Lord:
      "The lord of the 10th house sits in the {ord} house, connecting your career with {area}.",
    careerIn10: "{planet} in the 10th house brings {themes} into your work and public reputation.",
    field: {
      Sun: "Suitable fields (Sun): government and administration, management, politics, medicine and leadership roles.",
      Moon: "Suitable fields (Moon): public dealing, hospitality, nursing and care, food and dairy, travel and trade in liquids.",
      Mars: "Suitable fields (Mars): engineering, police and defence, surgery, sports, real estate and construction.",
      Mercury:
        "Suitable fields (Mercury): business and trade, accounts and banking, writing, media, IT and communication.",
      Jupiter:
        "Suitable fields (Jupiter): teaching, law, finance and advisory work, religious and counselling roles.",
      Venus:
        "Suitable fields (Venus): arts, music and film, fashion and beauty, hospitality, luxury goods and vehicles.",
      Saturn:
        "Suitable fields (Saturn): manufacturing, mining, oil and steel, labour-intensive industry, service and administration.",
      Rahu: "Suitable fields (Rahu): technology, aviation, foreign companies, research into new things, and politics.",
      Ketu: "Suitable fields (Ketu): research, medicine and healing, spirituality, computing and technical specialisation.",
    },
    mode: {
      job: "Service (a job) suits you more than independent business: steady employment brings better stability.",
      business:
        "Business and self-employment are well supported in your chart: trade, partnership and independent work can prosper.",
      both: "Both service and business are supported: you can begin in a job and later build your own business or a side venture.",
    },
    edu5Lord:
      "The lord of the 5th house (intelligence and learning) sits in the {ord} house, linking your studies with {area}.",
    prop4Lord:
      "The lord of the 4th house (home, vehicles and property) sits in the {ord} house, linking property and comforts with {area}.",
    foreignLikely: {
      high: "Strong indications of foreign travel, and possibly of settling abroad.",
      medium: "Some indications of foreign travel, mostly for work or study.",
      low: "Few indications of foreign travel; opportunities come mainly within the country.",
    },
    foreignInd: {
      rahu: "Rahu in the 1st, 7th, 9th or 12th house favours foreign connections.",
      lord12:
        "The 12th lord (foreign lands) in the 9th or 12th house supports long journeys abroad.",
      lord9in12: "The 9th lord (long journeys) in the 12th house links fortune with foreign lands.",
      moon12: "The Moon in the 12th house draws the mind towards distant places.",
      lagnalord:
        "The lagna lord in the 9th or 12th house points to travel and life away from the birthplace.",
    },
    obstacle: {
      malefic: "Malefic planets in the {n}th house can bring delays or friction in {topic}.",
      lordDusthana:
        "The lord of the {n}th house sits in a house of challenge (6th, 8th or 12th), so {topic} can face hurdles that need patience.",
    },
    areaTopic: {
      marriage: "marriage",
      career: "career",
      education: "education",
      property: "home, vehicles and property",
    },
  },

  hi: {
    dosha: {
      none: "इस कुंडली में कोई बड़ा दोष (मांगलिक, कालसर्प, साढ़ेसाती, पितृ, ग्रहण, गुरु चांडाल या श्रापित) नहीं मिला।",
      manglik:
        "मांगलिक (मंगल) दोष है: मंगल लग्न से 1, 2, 4, 7, 8 या 12वें भाव में है। परंपरा के अनुसार विवाह-मिलान में सावधानी चाहिए; ऐसे साथी से मिलान उत्तम माना जाता है जिसकी कुंडली में भी मांगलिक दोष हो।",
      manglikCancelled:
        "मंगल मांगलिक स्थिति में है, पर दोष भंग हो जाता है: मंगल स्वराशि या उच्च राशि में है, या उस पर गुरु का प्रभाव है। इसका असर बहुत कम हो जाता है।",
      kaalsarp:
        "कालसर्प दोष: सातों ग्रह राहु-केतु अक्ष के एक ओर हैं। यह अचानक उतार-चढ़ाव और देरी से जुड़ा है, जो निरंतर प्रयास से कम होती है।",
      sadesati:
        "साढ़ेसाती चल रही है: शनि आपकी चंद्र राशि से 12वीं, पहली या दूसरी राशि में गोचर कर रहा है। साढ़े सात वर्ष का यह समय धैर्य की परीक्षा लेता है; अनुशासित परिश्रम का फल मिलता है।",
      dhaiya:
        "शनि की ढैय्या (कंटक शनि) चल रही है: शनि आपकी चंद्र राशि से चौथी या आठवीं राशि में है। ढाई वर्ष का यह समय स्वास्थ्य, घर और काम में सावधानी माँगता है।",
      pitru:
        "पितृ दोष: नवम भाव में राहु या केतु है, या सूर्य के साथ राहु है। परंपरा में इसे पूर्वजों के ऋण से जोड़ा जाता है; यह भाग्य और पारिवारिक कार्यों को धीमा कर सकता है।",
      grahan:
        "ग्रहण दोष: सूर्य या चंद्र राहु या केतु के साथ है। यह आत्मविश्वास (सूर्य) या मन की शांति (चंद्र) को प्रभावित कर सकता है।",
      guruchandal:
        "गुरु चांडाल दोष: गुरु राहु के साथ है। निर्णय और गुरुजनों का मार्गदर्शन परखा जा सकता है; अच्छी सलाह और नैतिकता अपनाएँ।",
      shrapit: "श्रापित दोष: शनि राहु के साथ है। प्रयासों का फल धीरे मिल सकता है; धैर्य और सेवा से लाभ होता है।",
    },
    remedyDosha: {
      manglik:
        "मंगलवार को हनुमान चालीसा का पाठ करें, मसूर दाल का दान करें और मंगल शांति पूजा पर विचार करें। विवाह के लिए कुंभ विवाह या मांगलिक साथी से मिलान पारंपरिक उपाय है; निर्णय अपने ज्योतिषी के साथ लें।",
      kaalsarp:
        "रोज़ 'ॐ नमः शिवाय' का जाप करें, नाग पंचमी पर पूजा करें, और ज्योतिषी की सलाह से कालसर्प दोष पूजा (जैसे त्र्यंबकेश्वर में) करवाएँ।",
      sadesati:
        "शनिवार को हनुमान चालीसा और शनि मंत्र 'ॐ शं शनैश्चराय नमः' का पाठ करें, सरसों का तेल या काले तिल दान करें, और बुज़ुर्गों व श्रमिकों की सेवा करें।",
      dhaiya:
        "शनिवार को 'ॐ शं शनैश्चराय नमः' का जाप करें, पीपल के नीचे सरसों के तेल का दीपक जलाएँ, और मेहनतकश लोगों की मदद करें।",
      pitru:
        "पितृ पक्ष में श्राद्ध और तर्पण करें, ब्राह्मणों, गायों और कौओं को भोजन कराएँ, और ज्योतिषी की सलाह से नारायण बलि या त्रिपिंडी श्राद्ध पर विचार करें।",
      grahan:
        "सूर्य के लिए उगते सूर्य को जल अर्पित करें, चंद्र के लिए सोमवार को शिव पूजा करें, और ग्रहण के दिन दान करें।",
      guruchandal:
        "गुरुवार को 'ॐ बृं बृहस्पतये नमः' का जाप करें, गुरुजनों और बड़ों का सम्मान करें, और चने की दाल या हल्दी जैसी पीली वस्तुएँ दान करें।",
      shrapit:
        "महामृत्युंजय मंत्र का जाप करें, शनिवार को हनुमान चालीसा पढ़ें, और ज्योतिषी की सलाह से शनि-राहु शांति पूजा करवाएँ।",
    },
    remedyPlanet: {
      Sun: "सूर्य के लिए: उगते सूर्य को अर्घ्य दें, 'ॐ सूर्याय नमः' का जाप करें, पिता का सम्मान करें, और रविवार को गेहूँ या गुड़ दान करें।",
      Moon: "चंद्र के लिए: 'ॐ चंद्राय नमः' का जाप करें, सोमवार को शिव पूजा करें, दिनचर्या शांत रखें, और दूध या चावल दान करें।",
      Mars: "मंगल के लिए: मंगलवार को हनुमान चालीसा पढ़ें, 'ॐ मंगलाय नमः' का जाप करें, और मसूर दाल दान करें।",
      Mercury:
        "बुध के लिए: बुधवार को 'ॐ बुधाय नमः' का जाप करें, गायों को हरा चारा खिलाएँ, और हरी मूँग दान करें।",
      Jupiter:
        "गुरु के लिए: गुरुवार को 'ॐ बृं बृहस्पतये नमः' का जाप करें, गुरुजनों का सम्मान करें, और चने की दाल या हल्दी दान करें।",
      Venus:
        "शुक्र के लिए: शुक्रवार को 'ॐ शुक्राय नमः' का जाप करें, लक्ष्मी पूजा करें, और सफ़ेद मिठाई, चावल या वस्त्र दान करें।",
      Saturn:
        "शनि के लिए: शनिवार को 'ॐ शं शनैश्चराय नमः' का जाप करें, हनुमान चालीसा पढ़ें, और सरसों का तेल या काले तिल दान करें।",
      Rahu: "राहु के लिए: 'ॐ राहवे नमः' का जाप करें, दुर्गा पूजा करें, और शनिवार को कंबल या काली वस्तुएँ दान करें।",
      Ketu: "केतु के लिए: 'ॐ केतवे नमः' का जाप करें, गणेश पूजा करें, और कुत्तों को भोजन दें।",
    },
    karaka: {
      strong:
        "{topic} का कारक {planet} आपकी कुंडली में बलवान है (उच्च या स्वराशि): {topic} के लिए अच्छा सहारा।",
      weak: "{topic} का कारक {planet} आपकी कुंडली में कमज़ोर है (नीच, अस्त या चुनौती के भाव में), इसलिए {topic} में अधिक प्रयास और धैर्य चाहिए।",
      neutral:
        "{topic} का कारक {planet} सामान्य बल का है; {topic} से जुड़े फल यहाँ बताए अन्य कारकों पर निर्भर करते हैं।",
    },
    topic: {
      marriage: "विवाह और संबंधों",
      studyMercury: "बुद्धि और शिक्षा",
      studyJupiter: "उच्च शिक्षा और ज्ञान",
      vehicles: "वाहन और सुख-सुविधा",
      land: "भूमि और संपत्ति",
    },
    marriage7Sign:
      "आपका सप्तम भाव (विवाह) {sign} राशि में है: वैवाहिक जीवन और जीवनसाथी {qualities} स्वभाव के होते हैं।",
    marriage7Lord: "सप्तमेश भाव {ord} में है, जिससे विवाह का संबंध {area} से जुड़ता है।",
    marriageIn7: "सप्तम भाव में {planet} विवाह और साझेदारी में {themes} से जुड़े विषय लाता है।",
    career10Sign: "आपका दशम भाव (करियर) {sign} राशि में है: आप {qualities} ढंग से सबसे अच्छा काम करते हैं।",
    career10Lord: "दशमेश भाव {ord} में है, जिससे करियर का संबंध {area} से जुड़ता है।",
    careerIn10: "दशम भाव में {planet} आपके काम और प्रतिष्ठा में {themes} से जुड़े विषय लाता है।",
    field: {
      Sun: "उपयुक्त क्षेत्र (सूर्य): सरकारी सेवा और प्रशासन, प्रबंधन, राजनीति, चिकित्सा और नेतृत्व के पद।",
      Moon: "उपयुक्त क्षेत्र (चंद्र): जनसंपर्क, आतिथ्य, नर्सिंग और देखभाल, खाद्य और डेयरी, यात्रा और तरल पदार्थों का व्यापार।",
      Mars: "उपयुक्त क्षेत्र (मंगल): इंजीनियरिंग, पुलिस और सेना, सर्जरी, खेल, रियल एस्टेट और निर्माण।",
      Mercury: "उपयुक्त क्षेत्र (बुध): व्यापार, लेखा और बैंकिंग, लेखन, मीडिया, आईटी और संचार।",
      Jupiter: "उपयुक्त क्षेत्र (गुरु): शिक्षण, कानून, वित्त और सलाह, धार्मिक और परामर्श के कार्य।",
      Venus: "उपयुक्त क्षेत्र (शुक्र): कला, संगीत और फ़िल्म, फ़ैशन और सौंदर्य, आतिथ्य, विलासिता की वस्तुएँ और वाहन।",
      Saturn: "उपयुक्त क्षेत्र (शनि): निर्माण उद्योग, खनन, तेल और इस्पात, श्रम-प्रधान उद्योग, सेवा और प्रशासन।",
      Rahu: "उपयुक्त क्षेत्र (राहु): तकनीक, विमानन, विदेशी कंपनियाँ, नई चीज़ों पर शोध, और राजनीति।",
      Ketu: "उपयुक्त क्षेत्र (केतु): शोध, चिकित्सा और उपचार, आध्यात्मिकता, कंप्यूटिंग और तकनीकी विशेषज्ञता।",
    },
    mode: {
      job: "स्वतंत्र व्यापार की तुलना में नौकरी आपके लिए अधिक उपयुक्त है: स्थिर रोज़गार से बेहतर स्थिरता मिलती है।",
      business:
        "आपकी कुंडली में व्यापार और स्वरोज़गार को अच्छा सहारा है: व्यापार, साझेदारी और स्वतंत्र काम फल-फूल सकता है।",
      both: "नौकरी और व्यापार दोनों को सहारा है: आप नौकरी से शुरुआत करके बाद में अपना व्यापार या साइड व्यवसाय बना सकते हैं।",
    },
    edu5Lord: "पंचमेश (बुद्धि और शिक्षा) भाव {ord} में है, जिससे आपकी पढ़ाई का संबंध {area} से जुड़ता है।",
    prop4Lord:
      "चतुर्थेश (घर, वाहन और संपत्ति) भाव {ord} में है, जिससे संपत्ति और सुख-सुविधाओं का संबंध {area} से जुड़ता है।",
    foreignLikely: {
      high: "विदेश यात्रा के प्रबल योग हैं, और विदेश में बसने की संभावना भी।",
      medium: "विदेश यात्रा के कुछ योग हैं, अधिकतर काम या पढ़ाई के लिए।",
      low: "विदेश यात्रा के योग कम हैं; अवसर मुख्य रूप से देश के भीतर मिलते हैं।",
    },
    foreignInd: {
      rahu: "लग्न, सप्तम, नवम या द्वादश भाव में राहु विदेशी संबंधों को बढ़ाता है।",
      lord12: "द्वादशेश (विदेश) का नवम या द्वादश भाव में होना लंबी विदेश यात्राओं का संकेत है।",
      lord9in12: "नवमेश (लंबी यात्रा) द्वादश भाव में भाग्य को विदेश से जोड़ता है।",
      moon12: "द्वादश भाव में चंद्र मन को दूर के स्थानों की ओर ले जाता है।",
      lagnalord: "लग्नेश का नवम या द्वादश भाव में होना यात्रा और जन्मस्थान से दूर जीवन का संकेत है।",
    },
    obstacle: {
      malefic: "{n}वें भाव में पाप ग्रह {topic} में देरी या तनाव ला सकते हैं।",
      lordDusthana:
        "{n}वें भाव का स्वामी चुनौती के भाव (6, 8 या 12) में है, इसलिए {topic} में बाधाएँ आ सकती हैं जिनके लिए धैर्य चाहिए।",
    },
    areaTopic: {
      marriage: "विवाह",
      career: "करियर",
      education: "शिक्षा",
      property: "घर, वाहन और संपत्ति",
    },
  },

  gu: {
    dosha: {
      none: "આ કુંડળીમાં કોઈ મોટો દોષ (માંગલિક, કાલસર્પ, સાડાસાતી, પિતૃ, ગ્રહણ, ગુરુ ચાંડાલ કે શ્રાપિત) જોવા મળ્યો નથી.",
      manglik:
        "માંગલિક (મંગળ) દોષ છે: મંગળ લગ્નથી 1, 2, 4, 7, 8 કે 12મા ભાવમાં છે. પરંપરા મુજબ લગ્ન-મેળાપમાં કાળજી જરૂરી છે; જેની કુંડળીમાં પણ માંગલિક દોષ હોય તેવા જીવનસાથી સાથે મેળાપ ઉત્તમ ગણાય છે.",
      manglikCancelled:
        "મંગળ માંગલિક સ્થાનમાં છે, પણ દોષ ભંગ થાય છે: મંગળ સ્વરાશિ કે ઉચ્ચ રાશિમાં છે, અથવા તેના પર ગુરુની અસર છે. તેની અસર ઘણી ઓછી થઈ જાય છે.",
      kaalsarp:
        "કાલસર્પ દોષ: સાતેય ગ્રહ રાહુ-કેતુ અક્ષની એક બાજુ છે. તે અચાનક ચઢાવ-ઉતાર અને વિલંબ સાથે જોડાયેલો છે, જે સતત પ્રયત્નથી ઓછો થાય છે.",
      sadesati:
        "સાડાસાતી ચાલે છે: શનિ તમારી ચંદ્ર રાશિથી 12મી, પહેલી કે બીજી રાશિમાં ગોચર કરે છે. સાડા સાત વર્ષનો આ સમય ધીરજની કસોટી કરે છે; શિસ્તબદ્ધ પરિશ્રમનું ફળ મળે છે.",
      dhaiya:
        "શનિની ઢૈયા (કંટક શનિ) ચાલે છે: શનિ તમારી ચંદ્ર રાશિથી ચોથી કે આઠમી રાશિમાં છે. અઢી વર્ષનો આ સમય આરોગ્ય, ઘર અને કામમાં કાળજી માગે છે.",
      pitru:
        "પિતૃ દોષ: નવમ ભાવમાં રાહુ કે કેતુ છે, અથવા સૂર્ય સાથે રાહુ છે. પરંપરામાં તેને પૂર્વજોના ઋણ સાથે જોડવામાં આવે છે; તે ભાગ્ય અને કૌટુંબિક કાર્યો ધીમાં કરી શકે છે.",
      grahan:
        "ગ્રહણ દોષ: સૂર્ય કે ચંદ્ર રાહુ કે કેતુ સાથે છે. તે આત્મવિશ્વાસ (સૂર્ય) કે મનની શાંતિ (ચંદ્ર)ને અસર કરી શકે છે.",
      guruchandal:
        "ગુરુ ચાંડાલ દોષ: ગુરુ રાહુ સાથે છે. નિર્ણયશક્તિ અને ગુરુજનોનું માર્ગદર્શન કસોટીમાં આવી શકે છે; સારી સલાહ અને નીતિ અપનાવો.",
      shrapit: "શ્રાપિત દોષ: શનિ રાહુ સાથે છે. પ્રયત્નોનું ફળ ધીમે મળી શકે છે; ધીરજ અને સેવાથી લાભ થાય છે.",
    },
    remedyDosha: {
      manglik:
        "મંગળવારે હનુમાન ચાલીસાનો પાઠ કરો, મસૂરની દાળનું દાન કરો અને મંગળ શાંતિ પૂજા વિશે વિચારો. લગ્ન માટે કુંભ વિવાહ કે માંગલિક જીવનસાથી સાથે મેળાપ પરંપરાગત ઉપાય છે; નિર્ણય તમારા જ્યોતિષી સાથે લો.",
      kaalsarp:
        "રોજ 'ૐ નમઃ શિવાય'નો જાપ કરો, નાગ પાંચમે પૂજા કરો, અને જ્યોતિષીની સલાહથી કાલસર્પ દોષ પૂજા (જેમ કે ત્ર્યંબકેશ્વરમાં) કરાવો.",
      sadesati:
        "શનિવારે હનુમાન ચાલીસા અને શનિ મંત્ર 'ૐ શં શનૈશ્ચરાય નમઃ'નો પાઠ કરો, સરસવનું તેલ કે કાળા તલનું દાન કરો, અને વડીલો તથા શ્રમિકોની સેવા કરો.",
      dhaiya:
        "શનિવારે 'ૐ શં શનૈશ્ચરાય નમઃ'નો જાપ કરો, પીપળા નીચે સરસવના તેલનો દીવો કરો, અને મહેનતુ લોકોને મદદ કરો.",
      pitru:
        "પિતૃ પક્ષમાં શ્રાદ્ધ અને તર્પણ કરો, બ્રાહ્મણો, ગાયો અને કાગડાઓને ભોજન આપો, અને જ્યોતિષીની સલાહથી નારાયણ બલિ કે ત્રિપિંડી શ્રાદ્ધ વિશે વિચારો.",
      grahan: "સૂર્ય માટે ઊગતા સૂર્યને જળ અર્પણ કરો, ચંદ્ર માટે સોમવારે શિવ પૂજા કરો, અને ગ્રહણના દિવસે દાન કરો.",
      guruchandal:
        "ગુરુવારે 'ૐ બૃં બૃહસ્પતયે નમઃ'નો જાપ કરો, ગુરુજનો અને વડીલોનું સન્માન કરો, અને ચણાની દાળ કે હળદર જેવી પીળી વસ્તુઓનું દાન કરો.",
      shrapit:
        "મહામૃત્યુંજય મંત્રનો જાપ કરો, શનિવારે હનુમાન ચાલીસા વાંચો, અને જ્યોતિષીની સલાહથી શનિ-રાહુ શાંતિ પૂજા કરાવો.",
    },
    remedyPlanet: {
      Sun: "સૂર્ય માટે: ઊગતા સૂર્યને અર્ઘ્ય આપો, 'ૐ સૂર્યાય નમઃ'નો જાપ કરો, પિતાનું સન્માન કરો, અને રવિવારે ઘઉં કે ગોળનું દાન કરો.",
      Moon: "ચંદ્ર માટે: 'ૐ ચંદ્રાય નમઃ'નો જાપ કરો, સોમવારે શિવ પૂજા કરો, દિનચર્યા શાંત રાખો, અને દૂધ કે ચોખાનું દાન કરો.",
      Mars: "મંગળ માટે: મંગળવારે હનુમાન ચાલીસા વાંચો, 'ૐ મંગલાય નમઃ'નો જાપ કરો, અને મસૂરની દાળનું દાન કરો.",
      Mercury: "બુધ માટે: બુધવારે 'ૐ બુધાય નમઃ'નો જાપ કરો, ગાયોને લીલો ચારો ખવડાવો, અને લીલા મગનું દાન કરો.",
      Jupiter:
        "ગુરુ માટે: ગુરુવારે 'ૐ બૃં બૃહસ્પતયે નમઃ'નો જાપ કરો, ગુરુજનોનું સન્માન કરો, અને ચણાની દાળ કે હળદરનું દાન કરો.",
      Venus:
        "શુક્ર માટે: શુક્રવારે 'ૐ શુક્રાય નમઃ'નો જાપ કરો, લક્ષ્મી પૂજા કરો, અને સફેદ મીઠાઈ, ચોખા કે વસ્ત્રનું દાન કરો.",
      Saturn:
        "શનિ માટે: શનિવારે 'ૐ શં શનૈશ્ચરાય નમઃ'નો જાપ કરો, હનુમાન ચાલીસા વાંચો, અને સરસવનું તેલ કે કાળા તલનું દાન કરો.",
      Rahu: "રાહુ માટે: 'ૐ રાહવે નમઃ'નો જાપ કરો, દુર્ગા પૂજા કરો, અને શનિવારે ધાબળા કે કાળી વસ્તુઓનું દાન કરો.",
      Ketu: "કેતુ માટે: 'ૐ કેતવે નમઃ'નો જાપ કરો, ગણેશ પૂજા કરો, અને કૂતરાઓને ભોજન આપો.",
    },
    karaka: {
      strong: "{topic}નો કારક {planet} તમારી કુંડળીમાં બળવાન છે (ઉચ્ચ કે સ્વરાશિ): {topic} માટે સારો ટેકો.",
      weak: "{topic}નો કારક {planet} તમારી કુંડળીમાં નબળો છે (નીચ, અસ્ત કે પડકારના ભાવમાં), તેથી {topic}માં વધુ પ્રયત્ન અને ધીરજ જોઈએ.",
      neutral:
        "{topic}નો કારક {planet} સામાન્ય બળનો છે; {topic} સંબંધિત ફળ અહીં જણાવેલાં અન્ય પરિબળો પર આધાર રાખે છે.",
    },
    topic: {
      marriage: "લગ્ન અને સંબંધો",
      studyMercury: "બુદ્ધિ અને શિક્ષણ",
      studyJupiter: "ઉચ્ચ શિક્ષણ અને જ્ઞાન",
      vehicles: "વાહન અને સુખ-સગવડ",
      land: "જમીન અને મિલકત",
    },
    marriage7Sign:
      "તમારો સપ્તમ ભાવ (લગ્ન) {sign} રાશિમાં છે: લગ્નજીવન અને જીવનસાથી {qualities} સ્વભાવના હોય છે.",
    marriage7Lord: "સપ્તમેશ ભાવ {ord}માં છે, જેથી લગ્નનો સંબંધ {area} સાથે જોડાય છે.",
    marriageIn7: "સપ્તમ ભાવમાં {planet} લગ્ન અને ભાગીદારીમાં {themes} સંબંધિત બાબતો લાવે છે.",
    career10Sign:
      "તમારો દશમ ભાવ (કારકિર્દી) {sign} રાશિમાં છે: તમે {qualities} રીતે સૌથી સારું કામ કરો છો.",
    career10Lord: "દશમેશ ભાવ {ord}માં છે, જેથી કારકિર્દીનો સંબંધ {area} સાથે જોડાય છે.",
    careerIn10: "દશમ ભાવમાં {planet} તમારા કામ અને પ્રતિષ્ઠામાં {themes} સંબંધિત બાબતો લાવે છે.",
    field: {
      Sun: "યોગ્ય ક્ષેત્રો (સૂર્ય): સરકારી સેવા અને વહીવટ, મેનેજમેન્ટ, રાજકારણ, ચિકિત્સા અને નેતૃત્વના હોદ્દા.",
      Moon: "યોગ્ય ક્ષેત્રો (ચંદ્ર): જનસંપર્ક, આતિથ્ય, નર્સિંગ અને સંભાળ, ખાદ્ય અને ડેરી, પ્રવાસ અને પ્રવાહી પદાર્થોનો વેપાર.",
      Mars: "યોગ્ય ક્ષેત્રો (મંગળ): એન્જિનિયરિંગ, પોલીસ અને સેના, સર્જરી, રમતગમત, રિયલ એસ્ટેટ અને બાંધકામ.",
      Mercury: "યોગ્ય ક્ષેત્રો (બુધ): વેપાર, હિસાબ અને બેંકિંગ, લેખન, મીડિયા, આઈટી અને સંચાર.",
      Jupiter: "યોગ્ય ક્ષેત્રો (ગુરુ): શિક્ષણ, કાયદો, નાણાં અને સલાહ, ધાર્મિક અને પરામર્શનાં કાર્યો.",
      Venus: "યોગ્ય ક્ષેત્રો (શુક્ર): કલા, સંગીત અને ફિલ્મ, ફેશન અને સૌંદર્ય, આતિથ્ય, વૈભવી વસ્તુઓ અને વાહનો.",
      Saturn: "યોગ્ય ક્ષેત્રો (શનિ): ઉત્પાદન ઉદ્યોગ, ખાણકામ, તેલ અને સ્ટીલ, શ્રમપ્રધાન ઉદ્યોગ, સેવા અને વહીવટ.",
      Rahu: "યોગ્ય ક્ષેત્રો (રાહુ): ટેકનોલોજી, ઉડ્ડયન, વિદેશી કંપનીઓ, નવી બાબતો પર સંશોધન, અને રાજકારણ.",
      Ketu: "યોગ્ય ક્ષેત્રો (કેતુ): સંશોધન, ચિકિત્સા અને ઉપચાર, આધ્યાત્મિકતા, કમ્પ્યુટિંગ અને ટેકનિકલ નિપુણતા.",
    },
    mode: {
      job: "સ્વતંત્ર વેપાર કરતાં નોકરી તમારા માટે વધુ યોગ્ય છે: સ્થિર રોજગારથી વધુ સ્થિરતા મળે છે.",
      business:
        "તમારી કુંડળીમાં વેપાર અને સ્વરોજગારને સારો ટેકો છે: વેપાર, ભાગીદારી અને સ્વતંત્ર કામ ફૂલીફાલી શકે છે.",
      both: "નોકરી અને વેપાર બંનેને ટેકો છે: તમે નોકરીથી શરૂઆત કરી પછી પોતાનો વેપાર કે સાઇડ વ્યવસાય ઊભો કરી શકો છો.",
    },
    edu5Lord: "પંચમેશ (બુદ્ધિ અને શિક્ષણ) ભાવ {ord}માં છે, જેથી તમારા અભ્યાસનો સંબંધ {area} સાથે જોડાય છે.",
    prop4Lord:
      "ચતુર્થેશ (ઘર, વાહન અને મિલકત) ભાવ {ord}માં છે, જેથી મિલકત અને સુખ-સગવડનો સંબંધ {area} સાથે જોડાય છે.",
    foreignLikely: {
      high: "વિદેશ પ્રવાસના પ્રબળ યોગ છે, અને વિદેશમાં વસવાટની શક્યતા પણ.",
      medium: "વિદેશ પ્રવાસના કેટલાક યોગ છે, મોટે ભાગે કામ કે અભ્યાસ માટે.",
      low: "વિદેશ પ્રવાસના યોગ ઓછા છે; તકો મુખ્યત્વે દેશમાં જ મળે છે.",
    },
    foreignInd: {
      rahu: "લગ્ન, સપ્તમ, નવમ કે દ્વાદશ ભાવમાં રાહુ વિદેશી સંબંધો વધારે છે.",
      lord12: "દ્વાદશેશ (વિદેશ) નવમ કે દ્વાદશ ભાવમાં હોવું લાંબા વિદેશ પ્રવાસનો સંકેત છે.",
      lord9in12: "નવમેશ (લાંબો પ્રવાસ) દ્વાદશ ભાવમાં ભાગ્યને વિદેશ સાથે જોડે છે.",
      moon12: "દ્વાદશ ભાવમાં ચંદ્ર મનને દૂરનાં સ્થળો તરફ લઈ જાય છે.",
      lagnalord: "લગ્નેશ નવમ કે દ્વાદશ ભાવમાં હોવું પ્રવાસ અને જન્મસ્થળથી દૂર જીવનનો સંકેત છે.",
    },
    obstacle: {
      malefic: "ભાવ {n}માં પાપ ગ્રહ {topic}માં વિલંબ કે તણાવ લાવી શકે છે.",
      lordDusthana:
        "ભાવ {n}નો સ્વામી પડકારના ભાવ (6, 8 કે 12)માં છે, તેથી {topic}માં અવરોધ આવી શકે છે જેને ધીરજ જોઈએ.",
    },
    areaTopic: {
      marriage: "લગ્ન",
      career: "કારકિર્દી",
      education: "શિક્ષણ",
      property: "ઘર, વાહન અને મિલકત",
    },
  },
};

export const AREA_HOUSE: Record<Area, number> = {
  marriage: 7,
  career: 10,
  education: 5,
  property: 4,
};
