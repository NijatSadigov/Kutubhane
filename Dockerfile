# Two builds in one image: the Vite bundle and the Go binary that serves it.
#
# The build steps mirror .github/workflows/build.yml exactly — same Node, same
# Go, same flags, same empty VITE_API_ORIGIN. If the two ever drift, the
# release tarball and the container stop being the same software, and the bug
# you reproduce locally is not the one running in production.

# --------------------------------------------------------------- the UI
FROM node:24-alpine AS ui
WORKDIR /ui

# package files first, so a source-only change does not re-run npm ci.
COPY library-frontend/package.json library-frontend/package-lock.json ./
RUN npm ci

COPY library-frontend/ ./
# Set, and empty, on purpose: *same origin as the page*. The Go server hands
# out this bundle itself, so there is no second host and no CORS. Leaving it
# unset would bake in http://localhost:8000 — the visitor's own machine.
ENV VITE_API_ORIGIN=""
RUN npm run build

# -------------------------------------------------------------- the API
FROM golang:1.25-alpine AS api
WORKDIR /src

COPY school-library-system/go.mod school-library-system/go.sum ./
RUN go mod download

COPY school-library-system/ ./
# Static, so the final image needs no libc and the binary is the whole program.
ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/kutubhane . \
 && go build -trimpath -ldflags="-s -w" -o /out/createadmin ./cmd/createadmin \
 && go build -trimpath -ldflags="-s -w" -o /out/classfix   ./cmd/classfix

# ------------------------------------------------------------ the image
FROM alpine:3.21

# tzdata is not optional here. Due dates are whole calendar days — see
# overdueDays() in handlers/desk.go — so "today" has to be today in Baku. With
# the container's default UTC, a book due today reads as overdue for the four
# hours after midnight local, every night.
RUN apk add --no-cache tzdata ca-certificates \
 && addgroup -S kutubhane && adduser -S -G kutubhane -H -s /sbin/nologin kutubhane
ENV TZ=Asia/Baku

WORKDIR /app
COPY --from=api /out/kutubhane /out/createadmin /out/classfix ./
COPY --from=ui  /ui/dist ./dist

# uploads/ is a volume in compose; this is only so the path exists and belongs
# to the right user when nothing is mounted over it.
RUN mkdir -p /app/uploads/covers /app/uploads/ebooks \
 && chown -R kutubhane:kutubhane /app/uploads

USER kutubhane

# 0.0.0.0 inside the container, deliberately. The systemd deployment binds
# loopback because the proxy is on the same host; here Caddy is a *different
# container*, so loopback would make the app unreachable. The port is never
# published to the host — only the portfolio network can see it.
ENV PORT=8421 \
    STATIC_DIR=/app/dist \
    TRUST_PROXY=true
EXPOSE 8421

ENTRYPOINT ["/app/kutubhane"]
