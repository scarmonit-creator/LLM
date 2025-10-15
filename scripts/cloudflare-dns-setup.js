#!/usr/bin/env node

/**
 * Cloudflare DNS Setup for Nitric Custom Domain
 * Automates CNAME creation for www.scarmonit.com → Nitric CDN
 */

import { promises as fs } from 'fs';

class CloudflareDNSSetup {
  constructor() {
    this.domain = 'www.scarmonit.com';
    this.zone = 'scarmonit.com';
  }

  async log(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  async generateInstructions() {
    await this.log('🌐 Generating Cloudflare DNS setup instructions...');
    
    const instructions = `
# 🌐 CLOUDFLARE DNS SETUP FOR NITRIC CUSTOM DOMAIN

## 🎯 **OBJECTIVE**
Configure Cloudflare DNS to point www.scarmonit.com to your Nitric CDN endpoint.

## 🚀 **STEP-BY-STEP INSTRUCTIONS**

### **Step 1: Get Nitric CDN URL**
After running \`npm run nitric:deploy\`, Nitric will output something like:
\`\`\`
✅ Website deployed successfully!
CDN URL: d1234abcd5678.cloudfront.net (AWS)
      OR 
d1234abcd5678.azurefd.net (Azure)
      OR 
d1234abcd5678.web.app (GCP)
\`\`\`
**Copy this CDN URL** - you'll need it for Step 2.

### **Step 2: Login to Cloudflare Dashboard**
1. Go to: https://dash.cloudflare.com
2. Select the **scarmonit.com** zone
3. Navigate to **DNS > Records**

### **Step 3: Create CNAME Record**
1. Click **Add Record**
2. **Type**: CNAME
3. **Name**: www
4. **Target**: [PASTE YOUR NITRIC CDN URL HERE]
5. **Proxy status**: 🟡 Proxied (Orange cloud ON)
6. Click **Save**

### **Step 4: SSL/TLS Configuration**
1. Go to **SSL/TLS > Overview**
2. Set encryption mode to **Full** or **Full (Strict)**
3. Enable **Always Use HTTPS**

### **Step 5: Verify Configuration**
```bash
# Test DNS propagation (may take 5-10 minutes)
nslookup www.scarmonit.com

# Test website access
curl -I https://www.scarmonit.com

# Test API endpoints
curl https://www.scarmonit.com/api/llm-ai-bridge/health

# Test in browser
open https://www.scarmonit.com
```

## ⚡ **EXPECTED RESULTS**
After DNS propagation (5-10 minutes):
- ✅ https://www.scarmonit.com loads your Nitric dashboard
- ✅ https://www.scarmonit.com/api/llm-ai-bridge/health returns API status
- ✅ WebSocket connects to wss://www.scarmonit.com/ws/realtime
- ✅ https://www.scarmonit.com/nonexistent shows your custom 404 page

## 🔍 **TROUBLESHOOTING**

### **DNS Not Propagating**
```bash
# Check DNS status
dig www.scarmonit.com
nslookup www.scarmonit.com 8.8.8.8
```

### **SSL Certificate Issues**
- Ensure Cloudflare SSL mode is **Full** or **Full (Strict)**
- Nitric automatically provisions SSL certificates
- Wait 5-10 minutes for certificate provisioning

### **API/WebSocket Not Working**
- Verify Nitric services are deployed: \`nitric status\`
- Check CDN rewrites are configured in nitric.yaml
- Test API directly: \`curl [NITRIC-CDN-URL]/api/llm-ai-bridge/health\`

## 📊 **MONITORING SETUP**

Add Cloudflare monitoring:
1. **Speed > Optimization**: Enable Auto Minify, Brotli
2. **Analytics > Web Analytics**: Enable visitor analytics
3. **Security > Settings**: Configure security rules as needed
4. **Caching > Configuration**: Set appropriate cache rules

---

**🎯 STATUS**: Ready for DNS configuration after Nitric deployment
**🔗 NEXT**: Run \`npm run nitric:deploy\` and follow instructions above
`;

    await fs.writeFile('CLOUDFLARE_DNS_SETUP.md', instructions);
    await this.log('✅ Instructions saved to CLOUDFLARE_DNS_SETUP.md');
    
    return instructions;
  }

  async run() {
    try {
      await this.log('🚀 Starting Cloudflare DNS setup guide generation...');
      const instructions = await this.generateInstructions();
      await this.log('✅ Cloudflare DNS setup guide complete!');
      await this.log('\n' + '='.repeat(60));
      await this.log('🌐 CLOUDFLARE DNS SETUP READY');
      await this.log('='.repeat(60));
      await this.log('📝 Instructions: CLOUDFLARE_DNS_SETUP.md');
      await this.log('🚀 Deploy first: npm run nitric:deploy');
      await this.log('🔗 Then follow DNS setup instructions');
    } catch (error) {
      await this.log(`💥 Error: ${error.message}`);
      process.exit(1);
    }
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  new CloudflareDNSSetup().run();
}

export default CloudflareDNSSetup;