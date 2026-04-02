# PropertyLK AI Features with Groq - Implementation Plan

## 🎯 FOUR AI FEATURES OVERVIEW

### 1. NATURAL LANGUAGE SEARCH
**Example:** "Find me a 3-bed house under Rs 20M in Colombo"

**Architecture:**
- User types query → FastAPI endpoint `/ai/search/natural`
- Groq extracts parameters (beds, price, location, type)
- Backend converts to SQL filters
- Returns matching listings (from existing table)
- Cache results for 1 hour

**Groq Model:** `mixtral-8x7b-32768` (best for structured extraction)
**DB Changes:** None (uses existing listings table)
**Cost:** ~$0.02/month for 50 daily searches

**Flow:**
```
User: "3 bed house, colombo, under 20 million"
  ↓
Groq extracts JSON:
{
  "bedrooms": 3,
  "property_type": "house",
  "district": "Colombo",
  "max_price": 20000000
}
  ↓
SQL Query filters → 47 matching listings
```

---

### 2. SENTIMENT ANALYSIS
**Goal:** Analyze emotional tone of listing descriptions

**Why useful:**
- Detect scammy/overly emotional listings ("MUST SELL URGENT!!!")
- Badge system: Show sentiment score on each listing card
- Help buyers understand seller desperation level

**Architecture:**
- Run async batch job on all 5,493 listings
- Store sentiment_score (0-1) and sentiment_label in DB
- Add badge on listing cards (Positive/Neutral/Negative)
- Optional UI filter: "Show only positive sentiment listings"

**Groq Model:** `llama-2-70b-chat` (best for NLP classification)
**DB Changes:**
  - Add `listings.sentiment_score` (float)
  - Add `listings.sentiment_label` (varchar)
**Cost:** ~$1.50 to analyze all 5,493 listings once

**Example:**
```
Title: "Premium Land in Colombo - Best Location Ever!"
Description: "Beautiful plot. URGENT SALE!!!"
  ↓
Groq Analysis:
{
  "sentiment": "positive",
  "score": 0.78,
  "flags": ["urgency_language", "superlatives"]
}
  ↓
Display on card: [Positive 78%] badge
```

---

### 3. AUTO-DESCRIPTION GENERATION
**Goal:** Generate professional descriptions for sellers who can't write well

**User Flow:**
1. Seller fills form: beds, baths, size, location, price, amenities
2. Clicks "Generate with AI"
3. Groq writes 2-3 professional paragraphs
4. Seller reviews + edits + publishes

**Architecture:**
- Modal component with form inputs
- Endpoint: `POST /ai/describe/generate`
- Groq generates description on-demand
- No database changes (description stored in existing description field)

**Groq Model:** `mixtral-8x7b-32768` (creative + structured)
**DB Changes:** None
**Cost:** ~$0.03/month for 20 daily generations

**Example:**
```
Input:
{
  "property_type": "apartment",
  "bedrooms": 2,
  "bathrooms": 1.5,
  "size_sqft": 1100,
  "location": "Colombo 3",
  "price": 15000000,
  "amenities": ["balcony", "parking"]
}
  ↓
Groq Output:
"Welcome to this beautifully situated 2-bedroom apartment
in the heart of Colombo 3. Spanning 1100 sqft, this well-designed
unit features spacious living areas, a modern kitchen, and an
inviting balcony. With secure parking and proximity to shopping..."
```

---

### 4. PROPERTY VALUATION MODEL
**Goal:** Predict fair market price based on location, type, size, etc.

**Two Approaches:**

**Option A: XGBoost ML Model** (Recommended - Fast & Free)
- Train locally on your 5,493 listings data
- Store model in repo (pickle file ~1MB)
- Inference <1ms per property
- No API calls = no Groq costs for this feature
- Explain confidence score: "Fair Price Rs 45M ± Rs 5M (82% confidence)"

**Option B: Groq-Assisted** (Explainable but Slower)
- Send property details to Groq
- Groq uses market knowledge to estimate
- Takes 200-500ms per request
- Better for edge cases/unique properties

**Architecture (Option A - Recommended):**
- Train XGBoost on: district, property_type, bedrooms, bathrooms, size_sqft
- Store model in `backend/ml/models/valuation_v1.pkl`
- Endpoint: `GET /ai/valuation/predict?listing_id=123`
- Add columns: `listings.predicted_price`, `listings.price_confidence`
- Display badge: "Fair Price: Rs 40-50M | Listed at Rs 48M"

**Cost:** Free (after initial training)
**Accuracy:** ~80-85% confidence on similar properties

**Example:**
```
Property: 3-bed house, Colombo, 2000 sqft
  ↓
XGBoost Features:
{
  "district_colombo": 1,
  "property_type_house": 1,
  "bedrooms": 3,
  "bathrooms": 2,
  "size_sqft": 2000
}
  ↓
Prediction: Rs 45,000,000 ± Rs 5,000,000 (confidence: 0.82)
  ↓
Display: "Fair Price: Rs 40-50M | Listed at Rs 48M ✓ (Good Deal)"
```

---

## IMPLEMENTATION ROADMAP

### Priority Order (Recommended)

**Week 1: Natural Language Search** (HIGH IMPACT, MEDIUM EFFORT)
- Most immediately useful for users
- Groq setup + testing
- No DB changes needed
- 4-5 hours

**Week 2: Sentiment Analysis** (MEDIUM IMPACT, LOW EFFORT)
- Batch run on all listings
- Add UI badges
- Establishes credibility
- 2-3 hours

**Week 3: Property Valuation** (HIGH IMPACT, MEDIUM EFFORT)
- Train XGBoost model
- Add endpoints + UI badges
- Most valuable feature for investors
- 5-6 hours

**Week 4: Auto-Description** (MEDIUM IMPACT, LOW EFFORT)
- Modal component
- Description generation
- Polish + testing
- 2-3 hours

**Total Dev Time: ~19 hours**

---

## DATABASE SCHEMA ADDITIONS

```sql
-- Add columns to listings table
ALTER TABLE listings ADD COLUMN sentiment_score FLOAT DEFAULT NULL;
ALTER TABLE listings ADD COLUMN sentiment_label VARCHAR(20) DEFAULT NULL;
ALTER TABLE listings ADD COLUMN predicted_price NUMERIC(15,2) DEFAULT NULL;
ALTER TABLE listings ADD COLUMN price_confidence FLOAT DEFAULT NULL;

-- New cache table for AI results
CREATE TABLE ai_analysis_cache (
    id BIGSERIAL PRIMARY KEY,
    listing_id BIGINT REFERENCES listings(id),
    analysis_type VARCHAR(50), -- sentiment, valuation, description
    result JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);

-- Track NL search queries (analytics)
CREATE TABLE nl_search_history (
    id BIGSERIAL PRIMARY KEY,
    query TEXT,
    extracted_filters JSONB,
    result_count INT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## GROQ API SETUP

### Installation
```bash
pip install groq
```

### Environment Variables
```bash
GROQ_API_KEY=gsk_xxxxxxxxxxxxx
GROQ_MODEL_NL_SEARCH=mixtral-8x7b-32768
GROQ_MODEL_SENTIMENT=llama-2-70b-chat
GROQ_MODEL_DESCRIPTION=mixtral-8x7b-32768
```

### Python Service Layer
```python
# backend/services/groq_service.py
import os
import json
from groq import Groq

class GroqService:
    def __init__(self):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    async def extract_search_params(self, query: str):
        """Extract filters from natural language query"""
        response = self.client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[{
                "role": "user",
                "content": f"""Extract search filters from this query:
"{query}"

Return ONLY valid JSON with these fields (omit if not mentioned):
- bedrooms (int)
- bathrooms (float)
- property_type (string: land/house/apartment/commercial)
- district (string: Sri Lankan district name)
- min_price (int: Rs)
- max_price (int: Rs)
- listing_type (string: sale/rent)
- amenities (array of strings)"""
            }],
            temperature=0.1,
            max_tokens=200
        )
        try:
            return json.loads(response.choices[0].message.content)
        except:
            return None

    async def analyze_sentiment(self, title: str, description: str):
        """Analyze sentiment of listing text"""
        response = self.client.chat.completions.create(
            model="llama-2-70b-chat",
            messages=[{
                "role": "user",
                "content": f"""Analyze sentiment of this property listing:
Title: {title}
Description: {description}

Return JSON with:
- sentiment (string: positive/neutral/negative)
- score (float 0-1)
- flags (array: urgency_language, superlatives, negative_words, etc)
- reason (string: brief explanation)"""
            }],
            temperature=0.1,
            max_tokens=150
        )
        return json.loads(response.choices[0].message.content)

    async def generate_description(self, property_data: dict):
        """Generate professional description"""
        response = self.client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[{
                "role": "user",
                "content": f"""Write a professional 2-3 paragraph real estate listing
description for a Sri Lankan property with these details:
{json.dumps(property_data, indent=2)}

Make it engaging, highlight unique features, suitable for local market.
Don't include price in description."""
            }],
            temperature=0.7,
            max_tokens=400
        )
        return response.choices[0].message.content
```

---

## API ENDPOINTS

### 1. Natural Language Search
```
POST /api/ai/search/natural
Content-Type: application/json

{
  "query": "3 bed house in colombo under 20 million"
}

Response:
{
  "extracted_filters": {
    "bedrooms": 3,
    "property_type": "house",
    "district": "Colombo",
    "max_price": 20000000
  },
  "listings": [...24 listings...],
  "total": 47,
  "processing_time_ms": 340
}
```

### 2. Sentiment Analysis
```
GET /api/ai/sentiment/{listing_id}

Response:
{
  "listing_id": 5271,
  "sentiment": "positive",
  "score": 0.78,
  "flags": ["superlatives"],
  "reason": "Professional tone with positive descriptive language",
  "cached": false
}
```

### 3. Description Generation
```
POST /api/ai/describe/generate
Content-Type: application/json

{
  "property_type": "apartment",
  "bedrooms": 2,
  "bathrooms": 1.5,
  "size_sqft": 1100,
  "district": "Colombo 3",
  "price": 15000000,
  "amenities": ["balcony", "parking"]
}

Response:
{
  "description": "Welcome to this beautifully situated...",
  "length_words": 287,
  "tone": "professional"
}
```

### 4. Price Valuation
```
GET /api/ai/valuation/predict?listing_id=5271

Response:
{
  "listing_id": 5271,
  "predicted_price": 45000000,
  "confidence": 0.82,
  "price_range": {
    "min": 40000000,
    "max": 50000000
  },
  "fair_deal_indicator": "good" // good/fair/overpriced
}
```

---

## FRONTEND COMPONENTS

### NL Search Component
```typescript
export function NLSearchBar() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/search/natural", {
        method: "POST",
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      setResults(data.listings);
      // Update UI with results
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nl-search-container">
      <textarea
        placeholder="Try: '3 bed house in Colombo under 20M' or 'apartments near galle"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </button>
      {results.length > 0 && (
        <p className="text-sm text-text-muted">
          Found {results.length} matching properties
        </p>
      )}
    </div>
  );
}
```

### Sentiment Badge
```typescript
function SentimentBadge({ sentiment, score }) {
  const colors = {
    positive: "bg-success/15 text-success",
    neutral: "bg-warning/15 text-warning",
    negative: "bg-danger/15 text-danger"
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[sentiment]}`}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)} {Math.round(score * 100)}%
    </span>
  );
}
```

### Description Generator Modal
```typescript
export function DescriptionGeneratorModal({ onGenerate }) {
  const [formData, setFormData] = useState({
    property_type: "",
    bedrooms: 0,
    bathrooms: 0,
    size_sqft: 0,
    district: "",
    price: 0,
    amenities: []
  });
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/describe/generate", {
        method: "POST",
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      setGenerated(data.description);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal>
      {/* Form inputs for property details */}
      <form>
        <input type="text" placeholder="Property Type"
          onChange={(e) => setFormData({...formData, property_type: e.target.value})} />
        {/* ... more fields ... */}
      </form>

      <button onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating..." : "Generate Description"}
      </button>

      {generated && (
        <textarea value={generated} onChange={(e) => setGenerated(e.target.value)} />
      )}
    </Modal>
  );
}
```

---

## COST & PERFORMANCE ANALYSIS

### Groq Pricing
- **Mixtral-8x7b**: $0.27 per 1M input tokens, $0.27 per 1M output tokens
- **Llama-2-70b**: $0.70 per 1M input tokens, $0.90 per 1M output tokens

### Monthly Estimates (10k active users)
| Feature | Requests/Day | Monthly Cost |
|---------|-------------|------------|
| NL Search | 50 | ~$0.02 |
| Sentiment | 1 batch | ~$0.80 |
| Description | 20 | ~$0.03 |
| Valuation | 0 (local) | Free |
| **Total** | | **~$0.85/month** |

### Performance
- **Groq inference**: 10-50ms per request (very fast)
- **Caching**: Reduces API calls by 80%
- **XGBoost prediction**: <1ms locally
- **NL Search**: Full query → results: ~400ms

---

## DEPLOYMENT CHECKLIST

- [ ] Get free Groq API key (groq.com)
- [ ] Add GROQ_API_KEY to environment variables
- [ ] Create DB migration for new columns
- [ ] Build groq_service.py in backend/services/
- [ ] Create FastAPI routers for 4 endpoints
- [ ] Train XGBoost model on listings data
- [ ] Build React components (SearchBar, SentimentBadge, Modal)
- [ ] Add caching layer (Redis or in-memory)
- [ ] Unit tests for Groq integration
- [ ] Load testing (100 concurrent searches)
- [ ] Deploy to Railway
- [ ] Monitor Groq API usage via dashboard
- [ ] Set alerts for rate limits

---

## SUCCESS METRICS (Post-Launch)

- **NL Search**: Track query volume, conversion to listings
- **Sentiment**: Monitor if users engage differently with high vs low sentiment
- **Valuation**: Compare predicted vs actual selling prices
- **Description**: Track if generated descriptions get more inquiries

---

## NEXT STEPS

1. **Today/Tomorrow**: Get Groq API key (free tier available)
2. **This week**: Implement NL Search feature
3. **Next week**: Add Sentiment Analysis batch job
4. **Following week**: Train & integrate Valuation model
5. **Final week**: Auto-Description + polish + launch

Ready to start?
