import re
import time
import structlog
from typing import Dict, Optional, Tuple
from db.models import RawListing, Listing, Location
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

log = structlog.get_logger()

LOCATION_DISTRICT_MAP = {
    # --- Colombo District ---
    "Colombo": "Colombo",
    "Nugegoda": "Colombo",
    "Mount Lavinia": "Colombo",
    "Dehiwala": "Colombo",
    "Rajagiriya": "Colombo",
    "Battaramulla": "Colombo",
    "Kotte": "Colombo",
    "Sri Jayawardenepura": "Colombo",
    "Malabe": "Colombo",
    "Ratmalana": "Colombo",
    "Moratuwa": "Colombo",
    "Piliyandala": "Colombo",
    "Maharagama": "Colombo",
    "Homagama": "Colombo",
    "Kaduwela": "Colombo",
    "Athurugiriya": "Colombo",
    "Boralesgamuwa": "Colombo",
    "Kottawa": "Colombo",
    "Wellampitiya": "Colombo",
    "Kolonnawa": "Colombo",
    "Mulleriyawa": "Colombo",
    "Angulana": "Colombo",
    "Panagoda": "Colombo",
    "Kahathuduwa": "Colombo",
    "Thalawathugoda": "Colombo",
    "Hokandara": "Colombo",
    "Meegoda": "Colombo",
    "Koswatte": "Colombo",
    "Kirulapana": "Colombo",
    "Kirulapone": "Colombo",
    "Bambalapitiya": "Colombo",
    "Wellawatte": "Colombo",
    "Kollupitiya": "Colombo",
    "Borella": "Colombo",
    "Kotahena": "Colombo",
    "Maradana": "Colombo",
    "Pettah": "Colombo",
    "Slave Island": "Colombo",
    "Fort": "Colombo",
    "Havelock Town": "Colombo",
    "Narahenpita": "Colombo",
    "Thimbirigasyaya": "Colombo",
    "Thurstan": "Colombo",
    "Orugodawatte": "Colombo",
    "Mudungoda": "Colombo",
    "Mafahpitiya": "Colombo",
    "Welikade": "Colombo",
    "Nawala": "Colombo",
    "Paget Road": "Colombo",
    "Cinnamon Gardens": "Colombo",
    "Dematagoda": "Colombo",
    "Grandpass": "Colombo",
    "Pelawatte": "Colombo",
    "Pitakotte": "Colombo",
    "Mirihana": "Colombo",
    "Gangodawila": "Colombo",
    "Pepiliyana": "Colombo",
    "Gothatuwa": "Colombo",
    "Mullegama": "Colombo",
    "Dompe": "Colombo",
    "Padukka": "Colombo",
    "Hanwella": "Colombo",
    "Avissawella": "Colombo",
    # --- Gampaha District ---
    "Gampaha": "Gampaha",
    "Negombo": "Gampaha",
    "Kelaniya": "Gampaha",
    "Wattala": "Gampaha",
    "Ja-Ela": "Gampaha",
    "Ja Ela": "Gampaha",
    "Kiribathgoda": "Gampaha",
    "Kadawatha": "Gampaha",
    "Ragama": "Gampaha",
    "Biyagama": "Gampaha",
    "Minuwangoda": "Gampaha",
    "Divulapitiya": "Gampaha",
    "Mirigama": "Gampaha",
    "Attanagalla": "Gampaha",
    "Nittambuwa": "Gampaha",
    "Veyangoda": "Gampaha",
    "Meerigama": "Gampaha",
    "Delgoda": "Gampaha",
    "Ganemulla": "Gampaha",
    "Pugoda": "Gampaha",
    "Hendala": "Gampaha",
    "Peliyagoda": "Gampaha",
    "Seeduwa": "Gampaha",
    "Katunayake": "Gampaha",
    "Kotugoda": "Gampaha",
    "Weligampitiya": "Gampaha",
    "Ekala": "Gampaha",
    "Kandana": "Gampaha",
    "Mahara": "Gampaha",
    "Yakkala": "Gampaha",
    "Heiyanthuduwa": "Gampaha",
    "Gampola": "Gampaha",
    "Pamunugama": "Gampaha",
    "Walpita": "Gampaha",
    "Kapuwatta": "Gampaha",
    # --- Kalutara District ---
    "Kalutara": "Kalutara",
    "Panadura": "Kalutara",
    "Horana": "Kalutara",
    "Beruwala": "Kalutara",
    "Aluthgama": "Kalutara",
    "Bandaragama": "Kalutara",
    "Ingiriya": "Kalutara",
    "Matugama": "Kalutara",
    "Bulathsinhala": "Kalutara",
    "Agalawatta": "Kalutara",
    "Millaniya": "Kalutara",
    "Palindanuwara": "Kalutara",
    "Wadduwa": "Kalutara",
    "Maggona": "Kalutara",
    "Payagala": "Kalutara",
    "Dodangoda": "Kalutara",
    "Neboda": "Kalutara",
    "Welipenna": "Kalutara",
    "Baduraliya": "Kalutara",
    "Bombuwala": "Kalutara",
    "Poruwadanda": "Kalutara",
    # --- Kandy District ---
    "Kandy": "Kandy",
    "Peradeniya": "Kandy",
    "Katugastota": "Kandy",
    "Gampola": "Kandy",
    "Wattegama": "Kandy",
    "Digana": "Kandy",
    "Kundasale": "Kandy",
    "Akurana": "Kandy",
    "Kadugannawa": "Kandy",
    "Nawalapitiya": "Kandy",
    "Pilimathalawa": "Kandy",
    "Gelioya": "Kandy",
    "Daulagala": "Kandy",
    "Teldeniya": "Kandy",
    "Poojapitiya": "Kandy",
    "Medamahanuwara": "Kandy",
    "Hatharaliyadda": "Kandy",
    "Doluwa": "Kandy",
    "Harispattuwa": "Kandy",
    "Udunuwara": "Kandy",
    "Yatinuwara": "Kandy",
    "Gangawata Korale": "Kandy",
    "Pasbage Korale": "Kandy",
    "Ududumbara": "Kandy",
    "Minipe": "Kandy",
    "Pathahewaheta": "Kandy",
    "Tumpane": "Kandy",
    # --- Galle District ---
    "Galle": "Galle",
    "Hikkaduwa": "Galle",
    "Ambalangoda": "Galle",
    "Balapitiya": "Galle",
    "Elpitiya": "Galle",
    "Karandeniya": "Galle",
    "Baddegama": "Galle",
    "Bentota": "Galle",
    "Ahangama": "Galle",
    "Unawatuna": "Galle",
    "Koggala": "Galle",
    "Habaraduwa": "Galle",
    "Talpe": "Galle",
    "Imaduwa": "Galle",
    "Neluwa": "Galle",
    "Niyagama": "Galle",
    "Udugama": "Galle",
    "Bope-Poddala": "Galle",
    "Welikitara": "Galle",
    "Yakkalamulla": "Galle",
    "Akmeemana": "Galle",
    "Gonapinuwala": "Galle",
    "Wanduramba": "Galle",
    "Thawalama": "Galle",
    # --- Matara District ---
    "Matara": "Matara",
    "Weligama": "Matara",
    "Dikwella": "Matara",
    "Akuressa": "Matara",
    "Kamburupitiya": "Matara",
    "Deniyaya": "Matara",
    "Morawaka": "Matara",
    "Hakmana": "Matara",
    "Beliatta": "Matara",
    "Devinuwara": "Matara",
    "Mirissa": "Matara",
    "Pitabeddara": "Matara",
    "Welipitiya": "Matara",
    "Kotapola": "Matara",
    "Mulatiyana": "Matara",
    "Pasgoda": "Matara",
    "Athuraliya": "Matara",
    "Malimbada": "Matara",
    "Kirinda Puhulwella": "Matara",
    # --- Kurunegala District ---
    "Kurunegala": "Kurunegala",
    "Kuliyapitiya": "Kurunegala",
    "Nikaweratiya": "Kurunegala",
    "Maho": "Kurunegala",
    "Galgamuwa": "Kurunegala",
    "Ibbagamuwa": "Kurunegala",
    "Narammala": "Kurunegala",
    "Bingiriya": "Kurunegala",
    "Pannala": "Kurunegala",
    "Wariyapola": "Kurunegala",
    "Melsiripura": "Kurunegala",
    "Alawwa": "Kurunegala",
    "Hettipola": "Kurunegala",
    "Polpithigama": "Kurunegala",
    "Mawathagama": "Kurunegala",
    "Giriulla": "Kurunegala",
    "Kobeigane": "Kurunegala",
    "Dodangaslanda": "Kurunegala",
    "Galewela": "Kurunegala",
    "Rideegama": "Kurunegala",
    "Kotavehera": "Kurunegala",
    # --- Badulla District ---
    "Badulla": "Badulla",
    "Bandarawela": "Badulla",
    "Ella": "Badulla",
    "Welimada": "Badulla",
    "Haputale": "Badulla",
    "Diyatalawa": "Badulla",
    "Mahiyanganaya": "Badulla",
    "Passara": "Badulla",
    "Lunugala": "Badulla",
    "Haldummulla": "Badulla",
    "Soranathota": "Badulla",
    "Hali-Ela": "Badulla",
    "Uva Paranagama": "Badulla",
    "Kandaketiya": "Badulla",
    "Ridimaliyadda": "Badulla",
    "Meegahakivula": "Badulla",
    "Rideemaliyadda": "Badulla",
    "Ettampitiya": "Badulla",
    "Lunugala": "Badulla",
    # --- Nuwara Eliya District ---
    "Nuwara Eliya": "Nuwara Eliya",
    "Hatton": "Nuwara Eliya",
    "Talawakele": "Nuwara Eliya",
    "Dickoya": "Nuwara Eliya",
    "Kotagala": "Nuwara Eliya",
    "Ginigathena": "Nuwara Eliya",
    "Bogawantalawa": "Nuwara Eliya",
    "Lindula": "Nuwara Eliya",
    "Maskeliya": "Nuwara Eliya",
    "Agrapathana": "Nuwara Eliya",
    "Ragala": "Nuwara Eliya",
    "Walapane": "Nuwara Eliya",
    "Ambagamuwa": "Nuwara Eliya",
    "Hanguranketha": "Nuwara Eliya",
    "Kotmale": "Nuwara Eliya",
    "Nuwara Eliya Town": "Nuwara Eliya",
    # --- Ratnapura District ---
    "Ratnapura": "Ratnapura",
    "Embilipitiya": "Ratnapura",
    "Balangoda": "Ratnapura",
    "Eheliyagoda": "Ratnapura",
    "Kuruvita": "Ratnapura",
    "Kahawatta": "Ratnapura",
    "Weligepola": "Ratnapura",
    "Pelmadulla": "Ratnapura",
    "Kalawana": "Ratnapura",
    "Kolonne": "Ratnapura",
    "Ayagama": "Ratnapura",
    "Imbulpe": "Ratnapura",
    "Nivithigala": "Ratnapura",
    "Opanayake": "Ratnapura",
    "Godakawela": "Ratnapura",
    "Rakwana": "Ratnapura",
    "Kiriella": "Ratnapura",
    # --- Kegalle District ---
    "Kegalle": "Kegalle",
    "Mawanella": "Kegalle",
    "Rambukkana": "Kegalle",
    "Aranayaka": "Kegalle",
    "Deraniyagala": "Kegalle",
    "Ruwanwella": "Kegalle",
    "Warakapola": "Kegalle",
    "Yatiyanthota": "Kegalle",
    "Galigamuwa": "Kegalle",
    "Dehiowita": "Kegalle",
    "Bulathkohupitiya": "Kegalle",
    "Kitulgala": "Kegalle",
    # --- Anuradhapura District ---
    "Anuradhapura": "Anuradhapura",
    "Medawachchiya": "Anuradhapura",
    "Kekirawa": "Anuradhapura",
    "Eppawala": "Anuradhapura",
    "Nochchiyagama": "Anuradhapura",
    "Kahatagasdigiliya": "Anuradhapura",
    "Mihintale": "Anuradhapura",
    "Talawa": "Anuradhapura",
    "Horowpathana": "Anuradhapura",
    "Tambuttegama": "Anuradhapura",
    "Galenbindunuwewa": "Anuradhapura",
    "Padaviya": "Anuradhapura",
    "Maradankadawala": "Anuradhapura",
    "Ipalogama": "Anuradhapura",
    "Kebithigollewa": "Anuradhapura",
    "Thirappane": "Anuradhapura",
    "Nuwaragam Palatha": "Anuradhapura",
    "Nachchaduwa": "Anuradhapura",
    "Rajanganaya": "Anuradhapura",
    # --- Polonnaruwa District ---
    "Polonnaruwa": "Polonnaruwa",
    "Kaduruwela": "Polonnaruwa",
    "Hingurakgoda": "Polonnaruwa",
    "Medirigiriya": "Polonnaruwa",
    "Dimbulagala": "Polonnaruwa",
    "Manampitiya": "Polonnaruwa",
    "Welikanda": "Polonnaruwa",
    "Lankapura": "Polonnaruwa",
    "Thamankaduwa": "Polonnaruwa",
    "Elahera": "Polonnaruwa",
    # --- Matale District ---
    "Matale": "Matale",
    "Dambulla": "Matale",
    "Sigiriya": "Matale",
    "Naula": "Matale",
    "Rattota": "Matale",
    "Ukuwela": "Matale",
    "Pallepola": "Matale",
    "Wilgamuwa": "Matale",
    "Yatawatta": "Matale",
    "Laggala": "Matale",
    "Ambanganga Korale": "Matale",
    "Palapathwela": "Matale",
    # --- Puttalam District ---
    "Puttalam": "Puttalam",
    "Chilaw": "Puttalam",
    "Wennappuwa": "Puttalam",
    "Nattandiya": "Puttalam",
    "Anamaduwa": "Puttalam",
    "Marawila": "Puttalam",
    "Mahawewa": "Puttalam",
    "Dankotuwa": "Puttalam",
    "Nainamadama": "Puttalam",
    "Madampe": "Puttalam",
    "Mundel": "Puttalam",
    "Bangadeniya": "Puttalam",
    "Pallama": "Puttalam",
    "Nawagattegama": "Puttalam",
    "Karuwalagaswewa": "Puttalam",
    # --- Jaffna District ---
    "Jaffna": "Jaffna",
    "Chunnakam": "Jaffna",
    "Nallur": "Jaffna",
    "Kopay": "Jaffna",
    "Manipay": "Jaffna",
    "Uduvil": "Jaffna",
    "Kaithady": "Jaffna",
    "Inuvil": "Jaffna",
    "Ariyalai": "Jaffna",
    "Navaly": "Jaffna",
    "Point Pedro": "Jaffna",
    "Chavakachcheri": "Jaffna",
    "Velanai": "Jaffna",
    "Kayts": "Jaffna",
    "Tellippalai": "Jaffna",
    "Valvettithurai": "Jaffna",
    "Karainagar": "Jaffna",
    "Delft": "Jaffna",
    "Sandilipay": "Jaffna",
    "Chankanai": "Jaffna",
    # --- Vavuniya District ---
    "Vavuniya": "Vavuniya",
    "Omanthai": "Vavuniya",
    "Cheddikulam": "Vavuniya",
    "Nedunkeni": "Vavuniya",
    "Mankulam": "Vavuniya",
    "Vengalacheddikulam": "Vavuniya",
    # --- Mannar District ---
    "Mannar": "Mannar",
    "Musali": "Mannar",
    "Manthai West": "Mannar",
    "Nanatan": "Mannar",
    "Madu": "Mannar",
    "Madhu": "Mannar",
    # --- Kilinochchi District ---
    "Kilinochchi": "Kilinochchi",
    "Kandavalai": "Kilinochchi",
    "Pachchilaipalli": "Kilinochchi",
    "Poonakary": "Kilinochchi",
    "Karachchi": "Kilinochchi",
    # --- Mullaitivu District ---
    "Mullaitivu": "Mullaitivu",
    "Puthukudiyiruppu": "Mullaitivu",
    "Maritimepattu": "Mullaitivu",
    "Oddusuddan": "Mullaitivu",
    "Thunukkai": "Mullaitivu",
    "Welioya": "Mullaitivu",
    # --- Ampara District ---
    "Ampara": "Ampara",
    "Kalmunai": "Ampara",
    "Sammanthurai": "Ampara",
    "Sainthamaruthu": "Ampara",
    "Ninthavur": "Ampara",
    "Akkaraipattu": "Ampara",
    "Pottuvil": "Ampara",
    "Uhana": "Ampara",
    "Damana": "Ampara",
    "Mahaoya": "Ampara",
    "Padiyathalawa": "Ampara",
    "Dehiattakandiya": "Ampara",
    # --- Batticaloa District ---
    "Batticaloa": "Batticaloa",
    "Kattankudy": "Batticaloa",
    "Valaichenai": "Batticaloa",
    "Eravur": "Batticaloa",
    "Chenkaladi": "Batticaloa",
    "Vantharumoolai": "Batticaloa",
    "Oddamavadi": "Batticaloa",
    "Koralaipattu": "Batticaloa",
    "Manmunai": "Batticaloa",
    "Kaluwanchikudy": "Batticaloa",
    # --- Trincomalee District ---
    "Trincomalee": "Trincomalee",
    "Kinniya": "Trincomalee",
    "Muttur": "Trincomalee",
    "Seruvila": "Trincomalee",
    "Kantale": "Trincomalee",
    "Gomarankadawala": "Trincomalee",
    "Thampalakamam": "Trincomalee",
    "Kuchchaveli": "Trincomalee",
    "Nilaveli": "Trincomalee",
    "Uppuveli": "Trincomalee",
    # --- Hambantota District ---
    "Hambantota": "Hambantota",
    "Tangalle": "Hambantota",
    "Tissamaharama": "Hambantota",
    "Ambalantota": "Hambantota",
    "Weeraketiya": "Hambantota",
    "Sooriyawewa": "Hambantota",
    "Lunugamvehera": "Hambantota",
    "Kataragama": "Hambantota",
    "Ranna": "Hambantota",
    "Hungama": "Hambantota",
    "Okewela": "Hambantota",
    "Angunakolapelessa": "Hambantota",
    "Walasmulla": "Hambantota",
    # --- Monaragala District ---
    "Monaragala": "Monaragala",
    "Bibile": "Monaragala",
    "Wellawaya": "Monaragala",
    "Medagama": "Monaragala",
    "Buttala": "Monaragala",
    "Siyambalanduwa": "Monaragala",
    "Badalkumbura": "Monaragala",
    "Thanamalvila": "Monaragala",
    "Madulla": "Monaragala",
    "Sevanagala": "Monaragala",
}

class DataCleaner:
    def __init__(self, db: Session):
        self.db = db

    def _normalize_location_key(self, city: Optional[str], district: Optional[str]) -> Optional[str]:
        def norm(value: Optional[str]) -> str:
            if not value:
                return ""
            return re.sub(r"\s+", " ", value.strip().lower())
        city_n = norm(city)
        district_n = norm(district)
        if not city_n and not district_n:
            return None
        return f"{city_n}|{district_n}"

    def _get_or_create_location(
        self,
        district: Optional[str],
        city: Optional[str],
        confidence: str,
    ) -> Optional[Location]:
        key = self._normalize_location_key(city, district)
        if not key:
            return None
        location = self.db.query(Location).filter(Location.normalized_key == key).first()
        if not location:
            location = Location(
                normalized_key=key,
                district=district,
                city=city,
                confidence=confidence,
                source="cleaner",
            )
            self.db.add(location)
            self.db.flush()
        else:
            # Fill missing fields if we learned more
            if not location.district and district:
                location.district = district
            if not location.city and city:
                location.city = city
            if not location.confidence and confidence:
                location.confidence = confidence
        return location

    def parse_price(self, raw_price: str) -> Tuple[Optional[float], Optional[float]]:
        """Parses raw_price string to numeric LKR. Returns (total_price, price_per_unit)"""
        if not raw_price:
            return None, None

        # Strip trailing qualifiers before parsing
        clean_str = raw_price
        for suffix in ("Negotiable", "Fixed Price", "ONO", "Per Month", "per month",
                        "Per Night", "per night", "Per Day", "per day",
                        "Per Perch", "PSF", "per perch"):
            clean_str = clean_str.replace(suffix, "")
        # Strip brackets e.g. "[1396396 PSF]"
        clean_str = re.sub(r"\[.*?\]", "", clean_str)
        clean_str = clean_str.replace("Rs.", "").replace("LKR", "").replace(",", "").strip()

        # Handle "Million" / "Mn" / "M" suffix
        multiplier = 1.0
        if "Million" in clean_str:
            multiplier = 1_000_000.0
            clean_str = clean_str.replace("Million", "").strip()
        elif "Mn" in clean_str:
            multiplier = 1_000_000.0
            clean_str = clean_str.replace("Mn", "").strip()
        elif re.search(r"(\d)\s*M\b", clean_str):
            multiplier = 1_000_000.0
            clean_str = re.sub(r"M\b", "", clean_str).strip()

        # Check for per unit rates
        price_per_unit = None
        if "per perch" in clean_str.lower():
            val_match = re.findall(r"(\d+\.?\d*)", clean_str)
            if val_match:
                price_per_unit = float(val_match[0]) * multiplier
                # If it's just a per perch rate, total price is unknown yet
                return None, price_per_unit
        
        # Extract numeric value
        match = re.search(r"(\d+\.?\d*)", clean_str)
        if match:
            return float(match.group(1)) * multiplier, price_per_unit
        
        return None, None

    def parse_bedrooms(self, title: str, raw_size: str = "") -> Optional[int]:
        """Extract bedroom count from title or raw_size string."""
        text = (str(title or "") + " " + str(raw_size or "")).lower()
        # "3 bedroom", "3 bed", "3br", "3bhk", "3 bedroomed"
        m = re.search(r"(\d+)\s*(?:bed(?:room(?:ed)?)?s?|br\b|bhk)", text)
        if m:
            n = int(m.group(1))
            return n if 1 <= n <= 20 else None
        # "studio" → 1
        if "studio" in text:
            return 1
        return None

    def parse_size(self, raw_size: str, title: str = "") -> Tuple[Optional[float], Optional[float]]:
        """Parses size from raw_size or title. Returns (perches, sqft)"""
        text_to_search = (str(raw_size or "") + " " + str(title or "")).lower().strip()
        if not text_to_search:
            return None, None
        
        # Acres to Perches (1 acre = 160 perches)
        if "acre" in text_to_search:
            match = re.search(r"([\d,]+\.?\d*)\s*acre", text_to_search)
            if match:
                return float(match.group(1).replace(",", "")) * 160.0, None

        # Perches — handle comma-formatted numbers like "1,170.0 perches"
        p_match = re.search(r"([\d,]+\.?\d*)\s*(?:perch(?:es)?|p\b)", text_to_search)
        if p_match:
            return float(p_match.group(1).replace(",", "")), None

        # Sqft — match number immediately before the unit (not just any number in string)
        sqft_match = re.search(r"([\d,]+\.?\d*)\s*(?:sq\.?\s*ft|sqft)", text_to_search)
        if sqft_match:
            return None, float(sqft_match.group(1).replace(",", ""))
        
        return None, None

    # All 25 Sri Lanka districts — used as direct-match fallback
    ALL_DISTRICTS = [
        "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
        "Galle", "Matara", "Hambantota", "Jaffna", "Mannar", "Vavuniya",
        "Mullaitivu", "Kilinochchi", "Batticaloa", "Ampara", "Trincomalee",
        "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
        "Monaragala", "Ratnapura", "Kegalle",
    ]

    def parse_location(self, raw_location: str, title: str = "") -> Tuple[Optional[str], Optional[str], str]:
        """Parses location to (district, city, confidence)"""
        text_to_search = (str(raw_location or "") + " " + str(title or "")).lower()
        if not text_to_search.strip():
            return None, None, 'low'

        parts = [p.strip() for p in (raw_location or "").split(',')]
        city = parts[0] if parts else None
        district = None
        confidence = 'low'

        # 1. Check city→district map (longest match first to avoid partial hits)
        sorted_map = sorted(LOCATION_DISTRICT_MAP.items(), key=lambda x: len(x[0]), reverse=True)
        for loc, dist in sorted_map:
            if loc.lower() in text_to_search:
                district = dist
                city = city or loc
                confidence = 'high'
                break

        # 2. Direct district name match in the location string
        if not district:
            for d in self.ALL_DISTRICTS:
                if d.lower() in text_to_search:
                    district = d
                    confidence = 'high'
                    break

        # 3. Last comma-separated part might be district name
        if not district and len(parts) > 1:
            candidate = parts[-1].strip()
            for d in self.ALL_DISTRICTS:
                if d.lower() == candidate.lower():
                    district = d
                    confidence = 'medium'
                    break
            if not district:
                district = candidate if candidate else None
                confidence = 'medium'

        return district, city, confidence

    _SHORT_TERM_PRICE_SIGNALS = [
        "per night", "per day", "/night", "/day", "nightly", "daily rate",
    ]
    _SHORT_TERM_TEXT_SIGNALS = [
        "per night", "per day", "/night", "/day", "nightly", "daily rate",
        "holiday home", "holiday villa", "holiday bungalow", "holiday cabin",
        "vacation home", "vacation villa", "vacation rental",
        "short stay", "short-stay", "short term rental", "short-term rental",
        "airbnb",
    ]

    def detect_short_term(self, raw_price: str, title: str, description: str = "") -> bool:
        """Returns True if the listing appears to be a short-term/vacation rental.
        These should be excluded from monthly rental price aggregations."""
        price_text = (raw_price or "").lower()
        body_text = ((title or "") + " " + (description or "")).lower()

        for signal in self._SHORT_TERM_PRICE_SIGNALS:
            if signal in price_text:
                return True
        for signal in self._SHORT_TERM_TEXT_SIGNALS:
            if signal in body_text:
                return True
        return False

    def detect_outliers(self, listing: Listing):
        """Flags listing as outlier if price/size are suspicious.
        Uses different thresholds for sale vs rent listings."""
        reasons = []
        is_rent = (listing.listing_type == "rent")

        if listing.price_lkr:
            if is_rent:
                # Rent: flag anything below 5K LKR/month (unrealistically cheap)
                # or above 10M LKR/month (penthouse ceiling)
                if listing.price_lkr < 5_000:
                    reasons.append("Rent too low (<5K LKR/month)")
                if listing.price_lkr > 10_000_000:
                    reasons.append("Rent too high (>10M LKR/month)")
            else:
                # Sale: floor is 500K LKR (~$1,500 USD), ceiling is 2B LKR
                if listing.price_lkr < 500_000:
                    reasons.append("Sale price too low (<500K LKR)")
                if listing.price_lkr > 2_000_000_000:
                    reasons.append("Price too high (>2B LKR)")

        if listing.price_per_perch:
            if listing.price_per_perch > 50_000_000:
                reasons.append("Price per perch too high (>50M)")
            if listing.price_per_perch < 10_000:
                reasons.append("Price per perch too low (<10K)")

        if listing.size_perches and listing.size_perches > 10_000:
            reasons.append("Size too large (>10000 perches)")

        if reasons:
            listing.is_outlier = True
            listing.outlier_reason = "; ".join(reasons)

    def detect_duplicates(self, listing: Listing) -> bool:
        """Checks for duplicates based on price, location, size within 7 days"""
        if not listing.price_lkr or not listing.raw_location:
            return False
        
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        
        existing = self.db.query(Listing).filter(
            Listing.price_lkr == listing.price_lkr,
            Listing.raw_location == listing.raw_location,
            Listing.scraped_at >= seven_days_ago,
            Listing.source_id != listing.source_id
        ).first()

        if existing:
            listing.is_duplicate = True
            listing.duplicate_of = existing.id
            return True
        return False

    def process_all(self, limit: int = 500):
        """Processes a batch of unprocessed raw_listings to avoid memory issues."""
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        raw_listings = self.db.query(RawListing).filter(RawListing.is_processed == False).limit(limit).all()

        stats = {"processed": 0, "passed": 0, "outliers": 0, "duplicates": 0}

        for raw in raw_listings:
            try:
                # 1. Basic Cleaning
                price_lkr, price_per_perch = self.parse_price(raw.raw_price)
                size_perches, size_sqft = self.parse_size(raw.raw_size, raw.title)
                bedrooms = self.parse_bedrooms(raw.title, raw.raw_size)
                district, city, confidence = self.parse_location(raw.raw_location, raw.title)

                if not price_lkr and price_per_perch and size_perches:
                    price_lkr = price_per_perch * size_perches
                elif price_lkr and not price_per_perch and size_perches:
                    price_per_perch = price_lkr / size_perches

                location = self._get_or_create_location(district, city, confidence)
                location_id = location.id if location else None
                lat = location.lat if location else None
                lng = location.lng if location else None

                # 2. Build values dict
                is_outlier, outlier_reason = False, None
                is_short_term = self.detect_short_term(
                    raw.raw_price, raw.title, raw.description
                )
                dummy = Listing(
                    source=raw.source, source_id=raw.source_id,
                    scraped_at=raw.scraped_at, price_lkr=price_lkr,
                    original_price_lkr=price_lkr, price_per_perch=price_per_perch,
                    raw_location=raw.raw_location, district=district, city=city,
                    geocode_confidence=confidence, property_type=raw.property_type,
                    listing_type=raw.listing_type, size_perches=size_perches,
                    size_sqft=size_sqft, bedrooms=bedrooms, raw_id=raw.id,
                    location_id=location_id, lat=lat, lng=lng,
                    is_short_term=is_short_term,
                )
                self.detect_outliers(dummy)
                if dummy.is_outlier:
                    stats["outliers"] += 1

                is_duplicate = self.detect_duplicates(dummy)
                if is_duplicate:
                    stats["duplicates"] += 1
                else:
                    stats["passed"] += 1

                # 3. Upsert — ON CONFLICT (source, source_id) update price fields
                stmt = pg_insert(Listing).values(
                    raw_id=raw.id, source=raw.source, source_id=raw.source_id,
                    scraped_at=raw.scraped_at, price_lkr=price_lkr,
                    original_price_lkr=price_lkr, price_per_perch=price_per_perch,
                    price_per_sqft=None, raw_location=raw.raw_location,
                    district=district, city=city, geocode_confidence=confidence,
                    property_type=raw.property_type, listing_type=raw.listing_type,
                    size_perches=size_perches, size_sqft=size_sqft, bedrooms=bedrooms,
                    location_id=location_id, lat=lat, lng=lng,
                    is_outlier=dummy.is_outlier or False, outlier_reason=dummy.outlier_reason,
                    is_duplicate=dummy.is_duplicate or False, duplicate_of=dummy.duplicate_of,
                    is_short_term=is_short_term,
                ).on_conflict_do_update(
                    index_elements=["source", "source_id"],
                    set_={
                        "price_lkr": price_lkr,
                        "price_per_perch": price_per_perch,
                        "is_outlier": dummy.is_outlier or False,
                        "outlier_reason": dummy.outlier_reason,
                        "raw_location": raw.raw_location,
                        "district": district,
                        "city": city,
                        "is_short_term": is_short_term,
                        "scraped_at": raw.scraped_at,
                        "last_seen_at": datetime.utcnow(),
                    }
                )
                # Retry once on statement timeout before giving up
                for attempt in range(2):
                    try:
                        self.db.execute(stmt)
                        raw.is_processed = True
                        break
                    except Exception as exec_err:
                        if "QueryCanceled" in type(exec_err).__name__ or "canceling statement" in str(exec_err):
                            self.db.rollback()
                            self.db.expire_all()
                            if attempt == 0:
                                log.warning("clean_timeout_retry", raw_id=raw.id)
                                time.sleep(2)
                                continue
                        raise

            except Exception as e:
                log.error("clean_error", raw_id=raw.id, error=str(e))
                self.db.rollback()
                self.db.expire_all()

            stats["processed"] += 1

        try:
            self.db.commit()
        except Exception as e:
            log.error("clean_batch_commit_error", error=str(e))
            self.db.rollback()
            self.db.expire_all()

        log.info("clean_complete", **stats)
        return stats
