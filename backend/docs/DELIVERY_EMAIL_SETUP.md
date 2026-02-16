# Delivery Email Setup

Manual delivery APIs:

- `GET /api/deliveries` list delivery history with filters (`statuses`, `types`, `limit`).
- `POST /api/deliveries` create a delivery log entry (`type`: `email|whatsapp|direct_link`, `status`: `pending|sent|failed`).
- `PATCH /api/deliveries/:deliveryId/status` update status for an existing delivery.
- `POST /api/deliveries/send-email` send an email now via nodemailer (auto-saves pending -> sent/failed).

## Required environment variables

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=laptoptest7788@gmail.com
SMTP_PASS=uqfiabjkiqudrgdw
SMTP_FROM="DrishyaMitra <no-reply@example.com>"
```

## Request payload

```json
{
  "person": "David",
  "recipientEmail": "david@example.com",
  "subject": "Your photo memories are ready",
  "message": "Hi David, sharing the selected photos with you.",
  "photoLinks": [
    "https://example.com/photo-1",
    "https://example.com/photo-2"
  ]
}
```
