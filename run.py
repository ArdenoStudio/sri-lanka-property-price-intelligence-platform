import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"Starting server on port {port}")
    uvicorn.run("api.main:app", host="0.0.0.0", port=port, proxy_headers=True, forwarded_allow_ips="*")
