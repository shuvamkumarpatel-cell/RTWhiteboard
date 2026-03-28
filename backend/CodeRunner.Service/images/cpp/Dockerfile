FROM gcc:14
WORKDIR /workspace
COPY backend/CodeRunner.Service/images/cpp/run.sh /runner/run.sh
RUN chmod +x /runner/run.sh
ENTRYPOINT ["/runner/run.sh"]
