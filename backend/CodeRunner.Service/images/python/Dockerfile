FROM python:3.13-alpine
WORKDIR /workspace
COPY backend/CodeRunner.Service/images/python/run.sh /runner/run.sh
RUN chmod +x /runner/run.sh
ENTRYPOINT ["/runner/run.sh"]
