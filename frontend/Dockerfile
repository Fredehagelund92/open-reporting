FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Dev server runs on port 5173
EXPOSE 5173

# We use the development server for the compose setup 
# Alternatively, could do a production build and use nginx
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
