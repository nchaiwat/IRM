#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
================================================================================
 🏢 IRM — SAP Business One On-Premise Outbound Sync Agent (irm_agent_sync_v1.py)
 Window Asia Public Company Limited (Window Asia PCL.)
 Script Version : v1
================================================================================
 คำอธิบาย:
  - สคริปต์นี้ทำงานบน Server On-Premise ฝั่งโรงงาน เพื่อดึงข้อมูล Open PO จาก SAP B1
  - ยิงข้อมูลแบบ Outbound HTTPS POST ไปยังระบบ IRM บน VPS Hostinger
  - ไม่ต้องเปิด Port ขาเข้า (Zero Inbound Firewall Changes) ปลอดภัย 100%
================================================================================
 วิธีการใช้งาน:
  1. ติดตั้ง Library เชื่อมต่อฐานข้อมูล:
       pip install pyodbc requests
     (หรือ: pip install pymssql requests)
  2. สั่งรันด้วยตนเอง:
       python irm_agent_sync_v1.py
  3. ตั้งเวลาใน Windows Task Scheduler / Linux Cron (ตามรอบเวลาที่กำหนดใน System Setting)
================================================================================
"""

import sys
import os
import json
import time
import logging
from datetime import datetime

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("sap_sync.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("SAP_Agent")

# ==============================================================================
# ⚙️ CONFIGURATION (ฝังค่าอัตโนมัติจาก IRM System Settings)
# ==============================================================================
AGENT_VERSION  = "v1"
AGENT_FILENAME = "irm_agent_sync_v1.py"
GENERATED_AT   = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

IRM_INGEST_URL = "https://irm.windowasia.com/api/sap/inbound-push"
IRM_INGEST_KEY = "tok_irm_ingest_sec_8a39f029b4c12e87"

# SAP MS SQL Server On-Premise Connection
SQL_SERVER   = "wa-dbs2.wa.net"
SQL_PORT     = 1433
SQL_DATABASE = "SBO_COMPANY_DB"
SQL_USER     = "irm_readonly"
SQL_PASSWORD = ""

# SQL Query สำหรับดึง Open POs (กรองกลุ่มสินค้า 7 กลุ่ม)
SAP_SQL_QUERY = """SELECT 
    T1.DocNum AS po_number,
    T0.LineNum AS line_num,
    T1.DocDate AS po_date,
    T1.CardCode AS supplier_code,
    T1.CardName AS supplier_name,
    T3.Phone1 AS supplier_phone,
    T3.E_mail AS supplier_email,
    T3.CntctPrsn AS supplier_contact,
    T0.ItemCode AS item_code,
    T0.Dscription AS item_name,
    CAST(T0.Quantity AS FLOAT) AS quantity,
    T0.unitMsr AS unit,
    T0.ShipDate AS due_date,
    CAST(ISNULL(
        CASE
            WHEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            ) IS NULL
            THEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
            ELSE (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
        END, 0) AS FLOAT) AS received_qty,
    CAST(ISNULL(
        CASE
            WHEN (
                SELECT SUM(PDN1.Quantity)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            ) IS NULL
            THEN T0.Quantity - (
                SELECT ISNULL(SUM(PDN1.Quantity), 0)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
            ELSE T0.Quantity - (
                SELECT ISNULL(SUM(PDN1.Quantity), 0)
                FROM PDN1 
                LEFT OUTER JOIN OPDN ON OPDN.DocEntry = PDN1.DocEntry
                WHERE OPDN.CANCELED <> 'Y'
                  AND PDN1.ItemCode = T0.ItemCode
                  AND PDN1.BaseRef = T1.DocNum
                  AND PDN1.BaseLine = T0.LineNum
                  AND PDN1.BaseEntry = T1.DocEntry
            )
        END, T0.Quantity) AS FLOAT) AS remaining_qty,
    T5.ItmsGrpNam AS item_group,
    T4.SlpName AS buyer_name
FROM POR1 T0
INNER JOIN OPOR T1 ON T0.DocEntry = T1.DocEntry
LEFT JOIN OCRD T3 ON T1.CardCode = T3.CardCode
LEFT JOIN OSLP T4 ON T1.SlpCode = T4.SlpCode
LEFT JOIN OITM T2 ON T0.ItemCode = T2.ItemCode
LEFT JOIN OITB T5 ON T2.ItmsGrpCod = T5.ItmsGrpCod
WHERE T0.LineStatus = 'O'
  AND T1.CANCELED <> 'Y'
  AND T5.ItmsGrpCod IN (113, 115)
ORDER BY T1.DocNum DESC, T0.LineNum ASC;"""


def query_sap_data():
    """เชื่อมต่อ SAP MS SQL Server และดึงข้อมูล Open POs ทั้งหมด"""
    logger.info(f"Connecting to SAP MS SQL Server ({SQL_SERVER}:{SQL_PORT}/{SQL_DATABASE})...")
    records = []
    
    # 1. ลองเชื่อมต่อด้วย pyodbc (รองรับ ODBC Driver 17, 18, SQL Server)
    try:
        import pyodbc
        drivers = [
            "DRIVER={ODBC Driver 17 for SQL Server};",
            "DRIVER={ODBC Driver 18 for SQL Server};TrustServerCertificate=yes;",
            "DRIVER={SQL Server};",
        ]
        conn = None
        for drv in drivers:
            try:
                conn_str = (
                    f"{drv}"
                    f"SERVER={SQL_SERVER},{SQL_PORT};"
                    f"DATABASE={SQL_DATABASE};"
                    f"UID={SQL_USER};"
                    f"PWD={SQL_PASSWORD};"
                    "Timeout=20;"
                )
                conn = pyodbc.connect(conn_str)
                break
            except Exception:
                continue

        if conn is not None:
            cursor = conn.cursor()
            cursor.execute(SAP_SQL_QUERY)
            columns = [col[0] for col in cursor.description]
            for row in cursor.fetchall():
                row_dict = dict(zip(columns, row))
                for k, v in row_dict.items():
                    if isinstance(v, datetime):
                        row_dict[k] = v.isoformat()
                records.append(row_dict)
            cursor.close()
            conn.close()
            logger.info(f"Successfully fetched {len(records)} records using pyodbc.")
            return records
    except Exception as err_odbc:
        logger.warning(f"pyodbc connection attempt failed: {err_odbc}. Trying pymssql...")

    # 2. ลองเชื่อมต่อด้วย pymssql เป็น Fallback
    try:
        import pymssql
        conn = pymssql.connect(
            server=SQL_SERVER,
            port=SQL_PORT,
            user=SQL_USER,
            password=SQL_PASSWORD,
            database=SQL_DATABASE,
            timeout=20,
            as_dict=True,
        )
        cursor = conn.cursor()
        cursor.execute(SAP_SQL_QUERY)
        for row in cursor.fetchall():
            row_dict = dict(row)
            for k, v in row_dict.items():
                if isinstance(v, datetime):
                    row_dict[k] = v.isoformat()
            records.append(row_dict)
        cursor.close()
        conn.close()
        logger.info(f"Successfully fetched {len(records)} records using pymssql.")
        return records
    except Exception as err_mssql:
        logger.error(f"pymssql connection attempt also failed: {err_mssql}")
        raise RuntimeError(f"Cannot connect to SAP SQL Server: {err_mssql}")


def push_data_to_irm(records):
    """ส่งข้อมูลแบบ Outbound HTTPS POST ไปยัง IRM VPS Hostinger"""
    logger.info(f"Sending Outbound HTTPS POST to IRM ({IRM_INGEST_URL})...")
    
    headers = {
        "Content-Type": "application/json",
        "X-IRM-Ingest-Key": IRM_INGEST_KEY,
        "User-Agent": f"IRM-OnPrem-SAP-Agent/{AGENT_VERSION} ({AGENT_FILENAME})",
    }
    
    payload = {
        "records": records,
        "agent_version": AGENT_VERSION,
        "agent_filename": AGENT_FILENAME,
        "pushed_at": datetime.now().isoformat(),
        "source_host": os.environ.get("COMPUTERNAME", os.environ.get("HOSTNAME", "On-Prem-Server")),
    }
    
    import requests
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Send POST with verify=False to support Traefik / SSL Certs seamlessly
    response = requests.post(IRM_INGEST_URL, json=payload, headers=headers, timeout=90, verify=False)
    
    if response.status_code == 200:
        result = response.json()
        logger.info(f"SUCCESS! IRM Ingest Response: {result.get('message', 'OK')}")
        logger.info(f"Total Records: {result.get('total_records', len(records))}, Closed in SAP: {result.get('closed_count', 0)}, Purged Expired: {result.get('purged_count', 0)}")
        return result
    else:
        logger.error(f"FAILED! HTTP {response.status_code}: {response.text}")
        raise RuntimeError(f"IRM Ingestion Rejected (HTTP {response.status_code}): {response.text}")


def main():
    start_time = time.time()
    logger.info("================================================================================")
    logger.info(f"  IRM SAP ON-PREMISE SYNC AGENT [{AGENT_FILENAME}] STARTED [{datetime.now().strftime('%d/%m/%Y %H:%M:%S')}]")
    logger.info(f"  Target: {IRM_INGEST_URL} | Version: {AGENT_VERSION}")
    logger.info("================================================================================")
    
    try:
        records = query_sap_data()
        push_data_to_irm(records)
        elapsed = time.time() - start_time
        logger.info(f"Agent finished successfully in {elapsed:.2f} seconds.")
        logger.info("================================================================================\n")
        return 0
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(f"Sync Agent execution failed: {e} (Duration: {elapsed:.2f}s)")
        logger.info("================================================================================\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
