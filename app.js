const sgMail = require("@sendgrid/mail");
const puppeteer = require("puppeteer");

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const header = `
    <div class="header">
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%">
        <tbody>
          <tr>
            <td><img alt="Top Left Image" src="https://beyond-projects-files.s3.ca-central-1.amazonaws.com/Template/side.png" style="width:200px" /></td>
            <td><img alt="Company Logo" src="https://beyond-projects-files.s3.ca-central-1.amazonaws.com/Template/AIFA-Logo.png" style="width:40%; text-align: left;" />            
              <h3 style="margin-top: 20px;">Subject: Technical Inspection Report</h3>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  const footer = `
    <div class="footer">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width: 80%; padding: 10px 0;">
            <hr style="margin-left: 50%; margin-right: 30%;"/>
            <div style="margin-left:35%;">
              <p style="margin: 0;">Mob.: +971 50 725 2860, Del Ani Building, Office# FFA03, Al Quoz 3, Dubai - UAE</p>
              <p style="margin-left: 6%; color: rgb(0, 0, 0);">E-mail: info@aifaservices.ae, Website: www.aifaservices.ae</p>
            </div>
          </td>
          <td style="width: 20%; text-align: right;">
            <img src="https://beyond-projects-files.s3.ca-central-1.amazonaws.com/Template/RightSide.png" alt="Bottom Right Image" style="width: 200px; height: auto; display: inline-block;" />
          </td>
        </tr>
      </table>
    </div>
  `;

  const generatePageContent = (content) => `
    <html>
      <head>
        <style>
          @media print {
            .page {
              page-break-after: always;
              position: relative;
              height: 100%;
              width: 100%;
              margin: 0;
              padding: 0;
            }
            .footer {
              position: absolute;
              bottom: 0;
              width: 100%;
              text-align: center;
            }
            .content {
              margin-bottom: 60px; /* Space for footer */
            }
          }
        </style>
      </head>
      <body>
        <div class="page">
          ${header}
          <div class="content">
            ${content}
          </div>
          ${footer}
        </div>
      </body>
    </html>
  `;

  const generatePDF = async (content) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setContent(content);
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    await browser.close();
    return pdfBuffer;
  };

  const chunkContentIntoPages = (content, maxLength) => {
    const contentArray = content.split(" ");
    const pages = [];
    let currentPage = "";

    contentArray.forEach((word) => {
      if ((currentPage + word).length < maxLength) {
        currentPage += word + " ";
      } else {
        pages.push(currentPage.trim());
        currentPage = word + " ";
      }
    });

    pages.push(currentPage.trim());
    return pages;
  };

  app.get("/test", async (req, res) => {
    const rawContent = `
      <h1>Dynamic Content</h1>
      <p>${"This is dynamic content that will be split into multiple pages based on length. ".repeat(
        100
      )}</p>
    `;
    const maxLengthPerPage = 1000;
    const contentPages = chunkContentIntoPages(rawContent, maxLengthPerPage);

    const combinedContent = contentPages
      .map((content) => generatePageContent(content))
      .join("");

    try {
      const pdfBuffer = await generatePDF(combinedContent);

      const msg = {
        to: process.env.TO,
        from: process.env.FROM,
        subject: "Technical Inspection Report",
        text: "Please find the attached PDF report.",
        attachments: [
          {
            content: pdfBuffer.toString("base64"),
            filename: "Technical_Inspection_Report.pdf",
            type: "application/pdf",
            disposition: "attachment",
          },
        ],
      };

      await sgMail.send(msg);
      res.status(200).send("Email with PDF sent successfully");
    } catch (error) {
      console.error("Failed to send email:", error);
      res.status(500).send("Failed to send email");
    }
  });
};
