# Server da SECOMP UFSCar

Backend desenvolvido pela equipe de TI da SECOMP UFSCar especialmente para o evento. Tem como objetivo automatizar a gestão da SECOMP garantindo:

- Cadastro e organização de eventos (palestras, minicursos, atividades e etc.)
- Inscrição e controle de participantes
- Check-in eficiente via QR code
- Gestão de vagas e lista de espera

<br>

## 📋 Requisitos

Antes de mais nada, certifique-se de ter os seguintes programas instalados:

[![git][git-logo]][git-url]
[![node][node-logo]][node-url]
[![MySQL][mysql-logo]][mysql-url]

<br>

## **🛠️ Tecnologias**

Tecnologias utilizadas no backend do aplicativo: Node.js, Express, TypeScript, MySQL e Prisma.

![Skills](https://skills.syvixor.com/api/icons?i=nodejs,express,ts,mysql,prisma)

<br>

## 🪛 Configurações Iniciais

Clone o repositório

```
git clone https://github.com/secompufscar/secomp-server-xiv.git
cd secomp-server-xiv
```

<br>

Instale as dependências

```
npm install
```

<br>

**Configuração do Banco de Dados**

1. Crie um banco de dados MySQL (ex: `secomp_db`).

2. Crie o arquivo _.env_ e faça a cópia do conteúdo de .env.example.

3. Edite o _.env_ com suas credenciais do MySQL (usuário, senha):

4. Executar migrações do Prisma
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

<br>

**Configuração do envio de e-mail**

Defina `BREVO_API_KEY` no _.env_ com uma chave transacional válida da conta usada pela organização.

<br>

## ⚙️ Compilação

Compilar o projeto (TypeScript → JavaScript)

```
npm run build
```

<br>

## 📡 Iniciar o servidor

Modo desenvolvimento (com hot-reload via nodemon):

```
npm run dev
```

<br>

Modo produção:

```
npm start
```

<div align="center">
  <br/>
    <div>
      <sub>Copyright © 2024 - <a href="https://github.com/secompufscar">secompufscar</sub></a>
    </div>
</div>

[git-url]: https://git-scm.com/
[git-logo]: https://img.shields.io/badge/Git-f14e32?style=for-the-badge&logo=git&logoColor=white
[expo-url]: https://docs.expo.dev/
[expo-logo]: https://img.shields.io/badge/Expo-3ddc84?style=for-the-badge&logo=expo&logoColor=white
[node-url]: https://nodejs.org/en
[node-logo]: https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white
[mysql-url]: https://www.mysql.com/
[mysql-logo]: https://img.shields.io/badge/MySQL-00758F?style=for-the-badge&logo=mysql&logoColor=white
[demo]: assets/images/demo.gif
