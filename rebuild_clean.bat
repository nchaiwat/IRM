@echo off
echo === Step 1: Stopping and removing all containers + volumes ===
docker compose down -v
echo.
echo === Step 2: Rebuilding and starting containers ===
docker compose up -d --build
echo.
echo === Done! Waiting 15 seconds for backend to start... ===
timeout /t 15 /nobreak
echo.
echo === Step 3: Checking backend logs ===
docker logs irm-backend --tail 50
echo.
echo === Step 4: Testing API health ===
curl -s http://localhost/api/health
echo.
echo === Step 5: Testing items API (should return JSON array) ===
curl -s http://localhost/api/items
echo.
echo === Rebuild complete! ===
pause
