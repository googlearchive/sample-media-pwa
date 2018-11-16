# Start from the DockerHub Cloud Minimal Node base.
FROM node:6-alpine

# Copy everything in.
COPY . /app/

# Change directory to application root
WORKDIR ./app

# Install!
RUN npm --unsafe-perm install

# Expose Express.js port
EXPOSE 8080

# Expose run service
CMD npm start
