FROM node:24-alpine
WORKDIR /workspace
COPY backend/CodeRunner.Service/images/javascript/run.sh /runner/run.sh
RUN chmod +x /runner/run.sh
ENTRYPOINT ["/runner/run.sh"]
