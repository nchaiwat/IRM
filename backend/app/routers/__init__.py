from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.groups import router as groups_router
from app.routers.menus import router as menus_router
from app.routers.auth_matrix import router as auth_matrix_router
from app.routers.settings import router as settings_router
from app.routers.operation import router as operation_router
from app.routers.calendar import router as calendar_router
from app.routers.items import router as items_router
from app.routers.suppliers import router as suppliers_router
from app.routers.history import router as history_router
from app.routers.supplier_portal import router as supplier_portal_router
from app.routers.logs import router as logs_router
from app.routers.dashboard import router as dashboard_router
from app.routers.sap import router as sap_router
from app.routers.qms_integration import router as qms_integration_router

__all__ = [
    "auth_router",
    "users_router",
    "groups_router",
    "menus_router",
    "auth_matrix_router",
    "settings_router",
    "operation_router",
    "calendar_router",
    "items_router",
    "suppliers_router",
    "history_router",
    "supplier_portal_router",
    "logs_router",
    "dashboard_router",
    "sap_router",
    "qms_integration_router",
]
