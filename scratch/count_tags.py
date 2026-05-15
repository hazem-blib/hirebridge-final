with open('c:\\Users\\LOQ\\Desktop\\hirebridge-employer-review-page-fixed\\src\\app\\features\\employer\\review-candidates\\review-candidates-page.component.html', 'r', encoding='utf-8') as f:
    content = f.read()
    open_tags = content.count('<div')
    close_tags = content.count('</div')
    print(f"Open: {open_tags}, Close: {close_tags}")
