
# เอกสารการเชื่อมต่อ API ข้อมูลกำหนดส่งมอบวัตถุดิบ (IRM ➔ QMS)
**Incoming Raw Material (IRM) — Inbound Delivery Integration API Specification**

---

## 📌 1. ภาพรวม (Overview)
API เส้นนี้พัฒนาขึ้นเพื่อให้ระบบ **QMS (Quality Management System)** สามารถดึงข้อมูลกำหนดการส่งมอบวัตถุดิบ (Inbound Raw Material Delivery Schedule) จากระบบ **IRM** ที่ได้รับการยืนยันกำหนดส่งแล้ว (**Status: Confirmed**) ไปใช้วางแผนการตรวจรับวัตถุดิบเข้าคลังสินค้าได้อย่างถูกต้อง แม่นยำ และเป็นปัจจุบัน

---

## 🌐 2. ข้อมูลการเชื่อมต่อ (Connection & Environments)

| สภาพแวดล้อม (Environment) | Base URL |
| :--- | :--- |
| **Production (เซิร์ฟเวอร์จริง)** | `https://irm.windowasia.com` |
| **Development / Test (ทดสอบ)** | `http://localhost` (หรือ IP Test Server) |

---

## 🔐 3. การยืนยันตัวตนและความปลอดภัย (Authentication)
ระบบ IRM ใช้มาตรฐานความปลอดภัยด้วย **Secret API Key Authentication** ผ่าน HTTP Request Header

* **Header Key:** `X-API-Key`
* **Secret API Key (ค่าเริ่มต้น):** `irm_qms_secure_key_2026`
* *(หรือสามารถส่งแบบ `Authorization: Bearer <SECRET_KEY>` ได้เช่นกัน)*

> ⚠️ **ข้อควรระวัง:** หากไม่แนบ Header หรือ Secret Key ไม่ถูกต้อง ระบบจะปฏิเสธการเข้าถึงด้วยรหัส `HTTP 401 Unauthorized` ทันที

---

## 📡 4. รายละเอียด Endpoint (API Specification)

* **HTTP Method:** `GET`
* **Path:** `/api/external/qms/inbound-deliveries`
* **Full Production URL:** `https://irm.windowasia.com/api/external/qms/inbound-deliveries`

### 4.1 พารามิเตอร์สำหรับกรองข้อมูล (Query Parameters - Optional)
สามารถระบุพารามิเตอร์ต่อท้าย URL เพื่อกรองข้อมูลเฉพาะช่วงเวลาหรือรายการที่ต้องการได้:

| Parameter | ชนิดข้อมูล | ตัวอย่าง | คำอธิบาย |
| :--- | :---: | :---: | :--- |
| `date_from` | `string` (YYYY-MM-DD) | `2026-08-26` | วันที่เริ่มส่งมอบ (ดึงข้อมูลตั้งแต่วันนี้เป็นต้นไป) |
| `date_to` | `string` (YYYY-MM-DD) | `2026-09-30` | วันที่สิ้นสุดส่งมอบ (ดึงข้อมูลถึงวันที่กำหนด) |
| `po_number` | `string` | `260810159` | กรองเฉพาะเลขที่ใบสั่งซื้อ (PO) |
| `item_code` | `string` | `SP-3107-00000` | กรองเฉพาะรหัสสินค้า |

**ตัวอย่าง URL เมื่อใส่ Filter:**
```text
https://irm.windowasia.com/api/external/qms/inbound-deliveries?date_from=2026-08-26&date_to=2026-09-30
```

---

## 📦 5. โครงสร้างข้อมูลที่ตอบกลับ (Response Format)

* **Content-Type:** `application/json; charset=utf-8`
* **HTTP Status:** `200 OK`

### 5.1 ตัวอย่าง JSON Response
```json
{
  "status": "success",
  "timestamp": "2026-08-26T08:15:00.123456Z",
  "total_records": 2,
  "data": [
    {
      "po_number": "260810159",
      "po_date": "2026-08-21",
      "item_code": "SP-3107-00000",
      "description": "Fitting PU8 เกลียวนอก 1/4\"",
      "delivery_date": "2026-10-20",
      "quantity": 1.0,
      "unit": "Pcs.",
      "buyer": "ภิญญาดา",
      "supplier_code": "VQ-0417",
      "supplier_name": "ร้าน วรพล เทรดดิ้ง",
      "item_group": "SP - Sparepart",
      "is_split_round": true,
      "round_no": 1,
      "total_rounds": 2,
      "status": "confirmed",
      "confirmed_at": "2026-08-26T11:37:26"
    },
    {
      "po_number": "260810159",
      "po_date": "2026-08-21",
      "item_code": "SP-40125-00000",
      "description": "สายลม สีดำ 8 mm. (100 m)",
      "delivery_date": "2026-10-20",
      "quantity": 1.0,
      "unit": "Roll",
      "buyer": "ภิญญาดา",
      "supplier_code": "VQ-0417",
      "supplier_name": "ร้าน วรพล เทรดดิ้ง",
      "item_group": "SP - Sparepart",
      "is_split_round": false,
      "round_no": 1,
      "total_rounds": 1,
      "status": "confirmed",
      "confirmed_at": "2026-08-26T11:37:28"
    }
  ]
}
```

### 5.2 พจนานุกรมข้อมูล (Data Dictionary)

| ฟิลด์ (Field) | ชนิดข้อมูล (Type) | คำอธิบาย (Description) |
| :--- | :---: | :--- |
| `po_number` | `string` | เลขที่ใบสั่งซื้อ (PO Number) จากระบบ SAP |
| `po_date` | `string` (YYYY-MM-DD) | วันที่เปิดเอกสาร PO ใน SAP |
| `item_code` | `string` | รหัสสินค้า / รหัสวัตถุดิบ |
| `description` | `string` | ชื่อและรายละเอียดของสินค้า |
| `delivery_date` | `string` (YYYY-MM-DD) | **วันที่นัดส่งมอบวัตถุดิบจริงที่ได้รับการยืนยันแล้ว** |
| `quantity` | `float` | **จำนวนที่จะส่งมอบในรอบนั้นๆ** |
| `unit` | `string` | หน่วยนับของสินค้า (เช่น Pcs., Can, Roll, กล่อง) |
| `buyer` | `string` | ชื่อเจ้าหน้าที่ฝ่ายจัดซื้อผู้รับผิดชอบ PO นี้ |
| `supplier_code` | `string` | รหัสคู่ค้า / Supplier Code |
| `supplier_name` | `string` | ชื่อคู่ค้า / Supplier Name |
| `item_group` | `string` | กลุ่มสินค้า (เช่น RM-กระจก, SP - Sparepart) |
| `is_split_round`| `boolean` | ระบุว่ารายการนี้มีการแตกส่งมอบหลายรอบหรือไม่ (`true`/`false`) |
| `round_no` | `integer` | ลำดับรอบการส่งมอบ (กรณีแตกส่ง เช่น รอบที่ 1) |
| `total_rounds` | `integer` | จำนวนรอบการส่งมอบทั้งหมดของ Item นี้ |
| `status` | `string` | สถานะของรายการ (`confirmed`) |
| `confirmed_at` | `string` (ISO 8601) | วันและเวลาที่มีการกดยืนยันล่าสุด |

---

## 💻 6. ตัวอย่างโค้ดสำหรับผู้พัฒนา (Code Examples)

### 6.1 cURL
```bash
curl --location 'https://irm.windowasia.com/api/external/qms/inbound-deliveries?date_from=2026-08-26' \
--header 'X-API-Key: irm_qms_secure_key_2026'
```

### 6.2 Python
```python
import requests

url = "https://irm.windowasia.com/api/external/qms/inbound-deliveries"
headers = {
    "X-API-Key": "irm_qms_secure_key_2026",
    "Accept": "application/json"
}
params = {
    "date_from": "2026-08-26"  # Optional
}

response = requests.get(url, headers=headers, params=params, timeout=30)

if response.status_code == 200:
    result = response.json()
    print(f"ดึงข้อมูลสำเร็จ: {result['total_records']} รายการ")
    for item in result["data"]:
        print(f"PO: {item['po_number']} | Item: {item['item_code']} | วันส่ง: {item['delivery_date']} | จำนวน: {item['quantity']} {item['unit']}")
else:
    print(f"Error {response.status_code}: {response.text}")
```

### 6.3 C# (.NET)
```csharp
using System;
using System.Net.Http;
using System.Threading.Tasks;

class Program
{
    static async Task Main()
    {
        var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.Get, "https://irm.windowasia.com/api/external/qms/inbound-deliveries?date_from=2026-08-26");
        request.Headers.Add("X-API-Key", "irm_qms_secure_key_2026");

        var response = await client.SendAsync(request);
        if (response.IsSuccessStatusCode)
        {
            string responseBody = await response.Content.ReadAsStringAsync();
            Console.WriteLine(responseBody);
        }
        else
        {
            Console.WriteLine($"Failed with status: {response.StatusCode}");
        }
    }
}
```

### 6.4 Node.js (JavaScript)
```javascript
const axios = require('axios');

async function fetchInboundDeliveries() {
  try {
    const response = await axios.get('https://irm.windowasia.com/api/external/qms/inbound-deliveries', {
      headers: {
        'X-API-Key': 'irm_qms_secure_key_2026',
      },
      params: {
        date_from: '2026-08-26'
      }
    });

    console.log(`Total records: ${response.data.total_records}`);
    console.log(response.data.data);
  } catch (error) {
    console.error('Error fetching data:', error.response ? error.response.data : error.message);
  }
}

fetchInboundDeliveries();
```

---

## 🚦 7. รหัสตอบกลับ (HTTP Status Codes)

| HTTP Code | ความหมาย | คำอธิบาย |
| :---: | :--- | :--- |
| **`200 OK`** | สำเร็จ | ดึงข้อมูลสำเร็จและส่งรายการข้อมูลกลับใน payload |
| **`400 Bad Request`** | รูปแบบไม่ถูกต้อง | พารามิเตอร์วันที่ไม่ถูกต้อง (ต้องเป็นรูปแบบ YYYY-MM-DD) |
| **`401 Unauthorized`** | ไม่ได้รับอนุญาต | ไม่ได้แนบ `X-API-Key` หรือ Secret Key ไม่ถูกต้อง |
| **`500 Internal Error`**| เซิร์ฟเวอร์มีปัญหา | ข้อผิดพลาดภายในระบบ IRM (กรุณาแจ้งทีมดูแลระบบ) |

---

## ⏱️ 8. คำแนะนำการตั้งเวลาทำงาน (Scheduled Job Recommendation)
* แนะนำให้ QMS ตั้งเวลาดึงข้อมูล (Cron Job / Scheduled Task) เป็นประจำทุกเช้า (เช่น **08:15 น.** เป็นต้นไป)
* สามารถส่ง Parameter `date_from` เป็น **วันที่ปัจจุบัน** เพื่อลดปริมาณ Data และนำเฉพาะรายการที่ต้องส่งมอบตั้งแต่วันนี้เป็นต้นไปมาประมวลผล
