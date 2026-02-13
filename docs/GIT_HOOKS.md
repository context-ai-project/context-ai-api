# Git Hooks (Husky) - Context.ai API

El proyecto utiliza **Husky** y **lint-staged** para garantizar la calidad del código antes de hacer commits y pushes.

---

## 📋 Overview

Los Git Hooks se ejecutan automáticamente en puntos clave del flujo de trabajo Git, previniendo que código con errores llegue al repositorio.

---

## 🪝 Hooks Configurados

### Pre-commit Hook

Se ejecuta antes de cada commit:

- ✅ **Ejecuta lint-staged** en archivos modificados (solo los archivos staged)
- ✅ **Corrige automáticamente** errores de formato con Prettier
- ✅ **Ejecuta ESLint** con auto-fix en los archivos modificados
- ✅ **Bloquea el commit** si hay errores de ESLint que no se pueden corregir automáticamente

### Pre-push Hook

Se ejecuta antes de cada push:

- ✅ **Ejecuta todos los tests** unitarios (`pnpm test`)
- ✅ **Ejecuta el linter** en todo el código (`pnpm lint`)
- ✅ **Bloquea el push** si algún test falla o hay errores de lint

---

## ⚙️ Configuración

### Instalación Automática

Los hooks se instalan automáticamente al ejecutar `pnpm install` gracias al script `prepare` en `package.json`:

```json
{
  "scripts": {
    "prepare": "husky"
  }
}
```

### lint-staged

La configuración de `lint-staged` aplica las herramientas solo a los archivos staged:

```json
{
  "lint-staged": {
    "src/**/*.ts": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

---

## 🔧 Uso

### Flujo Normal

```bash
# Los hooks se ejecutan automáticamente
git add .
git commit -m "feat: nueva funcionalidad"   # → pre-commit hook
git push origin feature/mi-branch            # → pre-push hook
```

### Saltar Hooks (No Recomendado)

En casos excepcionales, puedes saltar los hooks:

```bash
# Saltar pre-commit
git commit --no-verify -m "mensaje"

# Saltar pre-push
git push --no-verify
```

> ⚠️ **Advertencia**: Saltar hooks puede resultar en código que no pasa CI/CD. Usa solo en situaciones excepcionales.

---

## 🛠️ Troubleshooting

### Hook no se ejecuta

```bash
# Reinstalar hooks
npx husky install

# Verificar que los scripts tengan permisos
chmod +x .husky/pre-commit
chmod +x .husky/pre-push
```

### Error de lint-staged

```bash
# Ejecutar lint-staged manualmente para debug
npx lint-staged --debug
```

---

## 📚 Recursos

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged Documentation](https://github.com/lint-staged/lint-staged)

---

**Última actualización**: Phase 7 - Testing & Consolidation
**Maintained By**: Context.AI Development Team

