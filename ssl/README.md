# SSL Sertifikaları

Bu dizin, Let's Encrypt SSL sertifikalarını içerir.

## Sertifika Alma

```bash
# Docker ile (önce nginx'in çalıştığından emin olun)
docker compose run --rm certbot

# Veya VPS üzerinde manuel:
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Sertifikaları buraya kopyalayın:
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/
```

## Development Ortamı için Self-Signed Sertifika

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./ssl/privkey.pem \
  -out ./ssl/fullchain.pem \
  -subj "/C=TR/ST=Istanbul/L=Istanbul/O=DGStok/CN=localhost"
```

**NOT:** Production'da asla self-signed sertifika kullanmayın!
