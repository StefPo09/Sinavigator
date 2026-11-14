import uvicorn
from fastapi import FastAPI

app = FastAPI(title="Sinavigator API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        proxy_headers=True,
        forwarded_allow_ips="192.168.111.140",
    )
