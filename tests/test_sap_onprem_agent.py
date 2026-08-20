"""
Automated Verification for SAP On-Premise Outbound Sync Agent (irm_agent_sync_vX.py).
"""

import sys
import time
import httpx
import asyncio

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost"

async def test_sap_agent_integration():
    print("\n" + "="*70)
    print(" 🧪 TESTING SAP ON-PREMISE AGENT (irm_agent_sync_vX.py) & INGEST API")
    print("="*70 + "\n")

    # Wait for backend to be ready
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        for _ in range(15):
            try:
                r = await client.get("/api/health")
                if r.status_code == 200:
                    break
            except Exception:
                await asyncio.sleep(1)

        # 1. Admin Login
        login_res = await client.post("/api/auth/login", json={"username": "admin", "password": "irm@2026"})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        admin_token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        print("  [PASS] 1. Admin Login successful")

        # 2. Test Script Generation View (irm_agent_sync_vX.py)
        res_script = await client.get("/api/sap/generate-agent-script", headers=headers)
        assert res_script.status_code == 200, f"Script gen failed: {res_script.text}"
        script_data = res_script.json()
        assert "irm_agent_sync_v" in script_data["filename"]
        assert "script" in script_data and "AGENT_VERSION" in script_data["script"]
        ingest_token = script_data["ingest_token"]
        current_fn = script_data["filename"]
        current_ver = script_data["version"]
        print(f"  [PASS] 2. Script Generator Verified: Filename='{current_fn}', Version='{current_ver}'")

        # 3. Test Script Download (Increments version & attaches header)
        res_dl = await client.get("/api/sap/generate-agent-script?download=true", headers=headers)
        assert res_dl.status_code == 200
        disposition = res_dl.headers.get("content-disposition", "")
        assert "attachment; filename=irm_agent_sync_v" in disposition
        print(f"  [PASS] 3. Download Attachment Verified: Content-Disposition='{disposition}'")

        # 4. Inbound Push with Invalid Key -> Rejected HTTP 401
        res_unauth = await client.post(
            "/api/sap/inbound-push",
            headers={"X-IRM-Ingest-Key": "tok_invalid_fake_key_123"},
            json={"records": [{"po_number": "PO-TEST", "item_code": "HW-001"}]}
        )
        assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
        print("  [PASS] 4. Security Check: Invalid Ingest Key Rejected (HTTP 401 Unauthorized)")

        # 5. Inbound Push with Valid Key -> Accepted HTTP 200
        mock_payload = {
            "records": [
                {
                    "po_number": "PO-TEST-AGENT-V1",
                    "line_num": 0,
                    "po_date": "2026-08-20T00:00:00Z",
                    "supplier_code": "VD-0720",
                    "supplier_name": "บริษัท อินซูโฟม อุตสาหกรรม (สมุทรสาคร) จำกัด",
                    "supplier_phone": "034119813",
                    "supplier_email": "n.chaiwat@gmail.com",
                    "supplier_contact": "คุณสมชาย",
                    "item_code": "HW-TEST-AGENT-001",
                    "item_name": "สินค้าทดสอบ On-Premise Ingest Agent v1",
                    "quantity": 3000.0,
                    "unit": "PCS",
                    "received_qty": 0.0,
                    "remaining_qty": 3000.0,
                    "due_date": "2026-09-20T00:00:00Z",
                    "item_group": "HW",
                    "buyer_name": "Patcha",
                }
            ],
            "agent_version": current_ver,
            "agent_filename": current_fn,
            "source_host": "WA-ONPREM-SRV01",
            "pushed_at": "2026-08-20T11:10:00Z"
        }
        res_push = await client.post(
            "/api/sap/inbound-push",
            headers={"X-IRM-Ingest-Key": ingest_token},
            json=mock_payload
        )
        assert res_push.status_code == 200, f"Push failed: {res_push.text}"
        push_res_json = res_push.json()
        assert push_res_json["status"] == "success"
        print(f"  [PASS] 5. Inbound HTTPS Push Ingested {push_res_json.get('total_records')} records successfully!")

        # 6. Verify Transaction Log has download record
        res_logs = await client.get("/api/logs?category=sap_sync", headers=headers)
        assert res_logs.status_code == 200
        logs_data = res_logs.json()
        logs_list = logs_data.get("items", []) if isinstance(logs_data, dict) else logs_data
        download_logs = [l for l in logs_list if l.get("action") == "download_agent_script"]
        assert len(download_logs) > 0, "Expected download_agent_script log entry!"
        latest_log = download_logs[0]
        print(f"  [PASS] 6. Audit Trail Log Verified: '{latest_log.get('message')}'")

    print("\n" + "="*70)
    print(" 🎉 ALL SAP AGENT VERSIONING & INGEST TESTS PASSED (6/6)")
    print("="*70 + "\n")

if __name__ == "__main__":
    asyncio.run(test_sap_agent_integration())
