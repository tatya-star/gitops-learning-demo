FROM nginx:1.30.5-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94

ARG SOURCE_REPOSITORY
ARG SOURCE_REVISION
LABEL org.opencontainers.image.source=$SOURCE_REPOSITORY
LABEL org.opencontainers.image.revision=$SOURCE_REVISION

COPY dist/ /usr/share/nginx/html/

EXPOSE 80