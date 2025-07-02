import React, { useState, useEffect } from 'react';

const ProtectedEmail: React.FC = () => {
  const [email, setEmail] = useState<string>('');

  // Этот код выполнится только в браузере пользователя,
  // собирая email из двух частей.
  useEffect(() => {
    const user = 'info';
    const domain = 'wedealz.com';
    setEmail(`${user}@${domain}`);
  }, []);

  // Если JavaScript еще не выполнился, показываем заглушку.
  if (!email) {
    return <span>[email protected]</span>;
  }

  // Когда email собран, показываем кликабельную ссылку.
  return (
    <a href={`mailto:${email}`} className="text-blue-400 hover:text-blue-300">
      {email}
    </a>
  );
};

export default ProtectedEmail;