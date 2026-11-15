import uvicorn

if __package__:
    from .app.main import app
else:
    from app.main import app


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        proxy_headers=True,
        forwarded_allow_ips="192.168.111.140",
    )
