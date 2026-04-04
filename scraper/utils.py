import hashlib

def build_snapshot_fingerprint(
    title: str,
    raw_price: str,
    raw_location: str,
    raw_size: str,
    property_type: str,
    listing_type: str,
    url: str,
):
    parts = [
        (title or "").strip(),
        (raw_price or "").strip(),
        (raw_location or "").strip(),
        (raw_size or "").strip(),
        (property_type or "").strip(),
        (listing_type or "").strip(),
        (url or "").strip(),
    ]
    payload = "|".join(parts).encode("utf-8")
    return hashlib.sha1(payload).hexdigest()
