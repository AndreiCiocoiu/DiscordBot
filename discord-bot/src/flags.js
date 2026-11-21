// Country flags for delivery posts. Trucky may send a country code; if not, the city name is looked up here.
const BY_COUNTRY = {
  RO: 'București Bucuresti Cluj-Napoca Timișoara Timisoara Iași Iasi Constanța Constanta Brașov Brasov Craiova Galați Galati Pitești Pitesti Bacău Bacau Târgu Mureș Targu Mures Hunedoara Reșița Resita Mangalia Călărași Calarasi Slatina Suceava Arad Oradea Sibiu Ploiești Ploiesti Deva Drobeta-Turnu Severin Botoșani Botosani',
  GB: 'London Aberdeen Edinburgh Glasgow Manchester Liverpool Birmingham Newcastle-upon-Tyne Newcastle Sheffield Leeds Cardiff Swansea Southampton Plymouth Dover Felixstowe Cambridge Carlisle Grimsby',
  DE: 'Berlin Hamburg München Munich Frankfurt am Main Frankfurt Köln Cologne Düsseldorf Dortmund Duisburg Bremen Hannover Leipzig Dresden Nürnberg Stuttgart Kiel Rostock Magdeburg Kassel Osnabrück Erfurt Mannheim Travemünde Lübeck Regensburg Bielefeld Wolfsburg Ingolstadt',
  FR: 'Paris Lyon Marseille Bordeaux Toulouse Lille Calais Strasbourg Metz Nantes Brest Le Havre Reims Dijon Limoges Montpellier Nice Rennes Clermont-Ferrand Bayonne Rouen Le Mans Alban Roscoff Saint-Nazaire Laon Paluel Golfech Civaux Bourges Cherbourg',
  NL: 'Amsterdam Rotterdam Groningen Eindhoven Utrecht Hoek van Holland Europoort Vlissingen',
  BE: 'Brussel Brussels Bruxelles Antwerpen Liège Liege Gent Zeebrugge Charleroi',
  LU: 'Luxembourg', CH: 'Zürich Zurich Bern Genève Geneva Basel Lausanne', AT: 'Wien Vienna Graz Linz Salzburg Innsbruck Klagenfurt am Wörthersee Klagenfurt',
  IT: 'Roma Rome Milano Milan Torino Venezia Venice Bologna Napoli Naples Firenze Florence Genova Verona Bari Palermo Catania Messina Taranto Livorno Ancona Pescara Parma Cassino Suzzara Terni Olbia Cagliari Sassari Villa San Giovanni Lamezia Terme Catanzaro Reggio Calabria',
  PL: 'Warszawa Warsaw Kraków Krakow Gdańsk Gdansk Poznań Poznan Wrocław Wroclaw Łódź Lodz Szczecin Katowice Lublin Białystok Bialystok Olsztyn Bydgoszcz',
  CZ: 'Praha Prague Brno Ostrava Plzeň Plzen', SK: 'Bratislava Košice Kosice Banská Bystrica', HU: 'Budapest Debrecen Szeged Pécs Pecs Győr Gyor',
  NO: 'Oslo Bergen Stavanger Kristiansand', SE: 'Stockholm Göteborg Gothenburg Malmö Malmo Uppsala Helsingborg Jönköping Linköping Örebro Västerås Kalmar Trelleborg Karlskrona Nynäshamn Södertälje Norrköping Kapellskär',
  DK: 'København Copenhagen Aalborg Esbjerg Odense Frederikshavn Hirtshals Gedser', FI: 'Helsinki Turku Tampere Kotka Kouvola Lahti Pori Loviisa Olkiluoto Naantali',
  EE: 'Tallinn Tartu Pärnu Parnu Narva Paldiski', LV: 'Riga Rīga Liepāja Liepaja Daugavpils Ventspils Rēzekne Valmiera', LT: 'Vilnius Kaunas Klaipėda Klaipeda Šiauliai Siauliai Panevėžys Utena Mažeikiai',
  RU: 'Sankt-Peterburg Saint Petersburg Pskov Luga Vyborg Kaliningrad Sosnovy Bor Velikiye Luki',
  BG: 'Sofia Sofiya Plovdiv Varna Burgas Ruse Pernik Pleven Veliko Tarnovo Kozloduy', TR: 'Istanbul İstanbul Edirne Tekirdağ Tekirdag',
  GR: 'Athína Athens Athina Thessaloniki Pátra Patras Larisa Ioannina Igoumenitsa Kavala Kalamata Volos Alexandroupoli',
  RS: 'Beograd Belgrade Novi Sad Niš Nis Kragujevac Subotica', HR: 'Zagreb Split Rijeka Osijek Pula Zadar', SI: 'Ljubljana Maribor Koper Celje',
  BA: 'Sarajevo Banja Luka Mostar Tuzla', ME: 'Podgorica Bar Nikšić', MK: 'Skopje Bitola', AL: 'Tirana Tiranë Durrës Durres Vlorë',
  ES: 'Madrid Barcelona València Valencia Sevilla Seville Bilbao Zaragoza Málaga Malaga A Coruña Vigo Murcia Almería Almeria Valladolid Salamanca Granada Córdoba Cordoba Pamplona Burgos Algeciras Cartagena Tarragona Santander Gijón Oviedo León Badajoz Mérida Albacete Huelva Cádiz Jaén Ciudad Real Lleida Puertollano Teruel Logroño Bailén',
  PT: 'Lisboa Lisbon Porto Faro Coimbra Setúbal Setubal Sines Évora Evora Guarda Leiria Viseu Olhão Ponte de Sor',
  UA: 'Kyiv Lviv Odesa', MD: 'Chișinău Chisinau', IE: 'Dublin Cork',
};
// names with spaces, so the lists above can be split on spaces
const MULTI = ['Târgu Mureș', 'Targu Mures', 'Drobeta-Turnu Severin', 'Frankfurt am Main', 'Le Havre', 'Le Mans', 'Hoek van Holland', 'Klagenfurt am Wörthersee',
  'Villa San Giovanni', 'Lamezia Terme', 'Reggio Calabria', 'Banská Bystrica', 'Saint Petersburg', 'Sosnovy Bor', 'Velikiye Luki', 'Veliko Tarnovo', 'Novi Sad',
  'Banja Luka', 'A Coruña', 'Ciudad Real', 'Ponte de Sor'];
const CITY = new Map();
for (const [cc, raw] of Object.entries(BY_COUNTRY)) {
  let list = raw; for (const m of MULTI) list = list.split(m).join(m.replace(/ /g, '_'));
  for (const name of list.split(' ')) if (name) CITY.set(name.replace(/_/g, ' ').toLowerCase(), cc);
}
const flag = (cc) => (/^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '');
const ALIAS = { UK: 'GB', EL: 'GR' };
function countryOf(city, code) {
  let cc = String(code || '').toUpperCase(); cc = ALIAS[cc] || cc;
  if (/^[A-Z]{2}$/.test(cc)) return cc;
  return CITY.get(String(city || '').trim().toLowerCase()) || '';
}
module.exports = { flag, countryOf };
