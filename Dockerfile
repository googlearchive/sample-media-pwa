# Start from the Cloud Node base.
FROM gcr.io/google-appengine/nodejs

# Copy everything in.
COPY . /app/

# Install!
RUN npm --unsafe-perm install
