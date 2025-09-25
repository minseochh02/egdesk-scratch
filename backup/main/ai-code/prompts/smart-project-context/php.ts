const expectedOutput = `
{
  "pathInventory": [
    "/",
    "/aboutus/",
    "/en_v1/",
    "/en_v1/index.php",
  ],
  "pathToFilesMap": {
    "/": ["index.php", "/env_1/index.php", "img/product/product1.jpg", "img/product/product2.jpg"],
    "/aboutus/": ["index.php", "/env_1/aboutus/index.php", "img/aboutus/aboutus1.jpg", "img/aboutus/aboutus2.jpg"],
    "/en_v1/": ["index.php", "/env_1/en_v1/index.php", "img/aboutus/aboutus1.jpg", "img/aboutus/aboutus2.jpg"],
    "/en_v1/index.php": ["index.php", "/env_1/en_v1/index.php", "img/product/product1.jpg", "img/product/product2.jpg"],
  },
  "sharedFiles": ["header.php", "footer.php", "global.css", "css/animate.css", "img/alogo.png"], 
}
`