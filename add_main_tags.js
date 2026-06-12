const fs = require('fs');
const path = require('path');

const dir = './';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'admin.html' && f !== 'index.html' && f !== 'article.html');

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if main already exists
    if (content.includes('<main>')) {
        console.log(`Skipping ${file}, <main> already exists.`);
        return;
    }

    // Wrap main content
    content = content.replace('</header>', '</header>\n    <main>');
    
    // Look for footer start to close main
    if (content.includes('<!-- Footer Section -->\n    <footer')) {
        content = content.replace('<!-- Footer Section -->\n    <footer', '    </main>\n\n    <!-- Footer Section -->\n    <footer');
    } else if (content.includes('<footer class="site-footer">')) {
        content = content.replace('<footer class="site-footer">', '</main>\n\n    <footer class="site-footer">');
    } else {
        console.log(`Warning: Could not find footer in ${file}`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated ${file}`);
});
