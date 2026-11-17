import logging
import os
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from .api import router as api_router
from .extra import router as extra_router


app = FastAPI(title="Эко Активист API", version="1.0.0")
app.include_router(api_router)
app.include_router(extra_router)
os.makedirs(os.getenv("UPLOAD_DIR", "/data/uploads"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=os.getenv("UPLOAD_DIR", "/data/uploads")), name="uploads")


@app.middleware("http")
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException):
    detail = error.detail if isinstance(error.detail, dict) else {"code": "http_error", "message": str(error.detail)}
    return JSONResponse({"code": detail.get("code", "http_error"), "message": detail.get("message", "Ошибка запроса"), "field_errors": detail.get("field_errors", {}), "request_id": request.state.request_id}, status_code=error.status_code)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    fields = {}
    for item in error.errors():
        key = ".".join(str(x) for x in item["loc"] if x not in ("body", "query"))
        fields.setdefault(key, []).append(item["msg"])
    return JSONResponse({"code": "invalid_fields", "message": "Проверьте поля формы", "field_errors": fields, "request_id": request.state.request_id}, status_code=422)


@app.exception_handler(Exception)
async def server_error(request: Request, error: Exception):
    logging.exception("Unhandled request error", exc_info=error)
    return JSONResponse({"code": "internal_error", "message": "Внутренняя ошибка сервера", "field_errors": {}, "request_id": request.state.request_id}, status_code=500)


@app.exception_handler(IntegrityError)
async def integrity_error(request: Request, error: IntegrityError):
    return JSONResponse({"code": "conflict", "message": "Операция конфликтует с текущими данными. Обновите страницу и повторите.", "field_errors": {}, "request_id": request.state.request_id}, status_code=409)


@app.get("/health")
def health():
    return {"ok": True}
