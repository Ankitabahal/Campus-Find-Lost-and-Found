import { createApp, initializeDatabase } from './app.js';

const port = Number(process.env.PORT || 5000);
const app = createApp();

initializeDatabase()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`CampusFind API listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize CampusFind API:', err);
    process.exit(1);
  });
