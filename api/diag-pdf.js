module.exports = async function handler(req,res){
  try{
    const { generateText } = await import('ai');
    const pdf=Buffer.from('JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCAzMDAgMzAwIF0gL1BhcmVudCA2IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago0IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNiAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwODIzMTE1NjQ0KzAwJzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwODIzMTE1NjQ0KzAwJzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0NvdW50IDEgL0tpZHMgWyAzIDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKNyAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxNzIKPj4Kc3RyZWFtCkdhczMtYm1NPFEkaj5MOFQ0M2lHVGRJcWk/RUw7Ki4hak8+cEVDPzooNWtFR0RzNm0/PGdFayReKjBOZ0hUTGtBJWh1dFlUTVBsIlRLYCpYS3R0cSszYC5QTDxwWykhTGRaTmk6Wlhia18mS29cSk1sRV0qZXMrOjR0cmpDMiZqblokNUNha0tvNHE4bzYtPTZdcVpWRS8pQmpccWxBc3RxU0w8O0kzcSFHfj5lbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA4CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDM5MiAwMDAwMCBuIAowMDAwMDAwNDYwIDAwMDAwIG4gCjAwMDAwMDA3MjEgMDAwMDAgbiAKMDAwMDAwMDc4MCAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9JRCAKWzwwOTAyZWM2NjdiYTdmMzQzYTQxYWVkM2QxYzBkMWM3Yj48MDkwMmVjNjY3YmE3ZjM0M2E0MWFlZDNkMWMwZDFjN2I+XQolIFJlcG9ydExhYiBnZW5lcmF0ZWQgUERGIGRvY3VtZW50IC0tIGRpZ2VzdCAob3BlbnNvdXJjZSkKCi9JbmZvIDUgMCBSCi9Sb290IDQgMCBSCi9TaXplIDgKPj4Kc3RhcnR4cmVmCjEwNDIKJSVFT0YK','base64');
    const result=await generateText({
      model:'google/gemini-2.5-flash-lite',
      messages:[{role:'user',content:[
        {type:'text',text:'Lee este PDF y responde SOLO con el total de la factura.'},
        {type:'file',mediaType:'application/pdf',data:pdf,filename:'test.pdf'}
      ]}],
      maxOutputTokens:50
    });
    res.status(200).json({ok:true,text:result.text,model:'google/gemini-2.5-flash-lite'});
  }catch(e){
    console.error('PDF diagnostic',e?.name,e?.message);
    res.status(200).json({ok:false,error:e?.message||String(e),name:e?.name||null});
  }
}
