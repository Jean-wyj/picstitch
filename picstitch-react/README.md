# PicStitch 拼图工坊
纯前端在线图片拼接工具：横拼 / 竖拼 / 田字 / 自由拼接，裁剪缩放、方框与文字标注、高清导出与复制。图片只在浏览器本地处理。

```
npm install
npm run dev      # 本地开发
npm run build    # 生成 dist
```
部署：推送到 GitHub 的 main 分支，并在 Settings → Pages → Source 选择 **GitHub Actions**。
结构：`src/engine.ts` 画布引擎（拼接、编辑、导出），`src/App.tsx` 界面。
