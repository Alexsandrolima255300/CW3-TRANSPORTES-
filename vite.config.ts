import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const cw3Defaults: Plugin = {
  name: 'cw3-default-origin-cep',
  transform(code, id) {
    if (id.endsWith('/src/App.tsx')) {
      return code.replace(
        "const [originCep, setOriginCep] = useState('');",
        "const [originCep, setOriginCep] = useState('38064700');"
      );
    }
    return null;
  },
};

export default defineConfig({
  plugins: [react(), cw3Defaults],
});
