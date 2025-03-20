# README

## 実行

```bash
docker run -d -p 8443:8000 -v $PWD/basic/custom:/data/custom fabriciomendonca/json-server-https
```

- https://github.com/fabriciomendonca/docker-json-server-https

## お試し

```bash
curl --insecure https://localhost:8443/posts/1
```
