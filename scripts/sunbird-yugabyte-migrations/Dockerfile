FROM yugabytedb/yugabyte:latest

# Copy migration scripts from the local repository
COPY scripts/sunbird-yugabyte-migrations /opt/migrations/sunbird-yugabyte-migrations

# Set proper permissions
RUN chmod -R 755 /opt/migrations/sunbird-yugabyte-migrations

# Set working directory
WORKDIR /opt/migrations/sunbird-yugabyte-migrations

# Default command (can be overridden)
CMD ["/bin/bash"]
