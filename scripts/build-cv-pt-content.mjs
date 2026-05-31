#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { CV } from "./cv-content.mjs";

const en = structuredClone(CV.en);
en.lang = "pt";
en.title = "Currículo — Norberto S. Brude | Kinésica";
en.description =
  "Currículo de Norberto S. Brude: fisioterapeuta, osteopata e especialista em RPG, terapia manual e neurodinâmica em Palermo, Buenos Aires.";
en.role = "Licenciado em fisioterapia e fisiatria";
en.location = "Cidade Autônoma de Buenos Aires";
en.methodsTitle = "Métodos e técnicas";
en.methods = [
  "Fisioterapia",
  "Osteopatia",
  "RPG",
  "Cadeias fisiológicas",
  "Método Barral",
  "Neurodinâmica",
];
en.coursesTitle = "Congressos e cursos";
en.summaryTitle = "Resumo";
en.summary =
  "Tenho 36 anos de trajetória, combinando trabalho em instituições de saúde com atendimento personalizado em consultório. Especializo-me em terapias manuais, com foco no tratamento da dor, reabilitação funcional e bem-estar integral de cada paciente.";
en.experienceTitle = "Experiência";
en.keyLabel = "Responsabilidades principais:";
en.ctaTitle = "Fale conosco e agende";
en.ctaText = "Antes da primeira sessão podemos ligar para tirar dúvidas.";
en.ctaBtn = "Contato";
en.homeName = "Início";
en.breadcrumb = "Currículo";
en.time = "Segunda a sexta: <strong>10 h às 20 h</strong>";

const out = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "cv-content-pt.mjs",
);
fs.writeFileSync(
  out,
  `export const CV_PT = ${JSON.stringify(en, null, 2)};\n`,
);
console.log("Wrote", path.basename(out));
