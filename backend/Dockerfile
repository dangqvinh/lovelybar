FROM golang:1.25-alpine AS build
WORKDIR /src
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /out/server ./cmd/server

FROM alpine:3.20
RUN adduser -D app && mkdir -p /data/uploads && chown -R app /data
USER app
COPY --from=build /out/server /server
ENV UPLOAD_DIR=/data/uploads
EXPOSE 8080
CMD ["/server"]
