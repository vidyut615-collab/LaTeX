import fitz

# ========================================================
# LAYER 3 & 4: AST (Abstract Syntax Tree) NODES
# ========================================================

class Node:
    def render(self) -> str:
        pass
    def get_bbox(self) -> list:
        pass

class TextNode(Node):
    def __init__(self, span):
        self.text = span["text"]
        self.bbox = span["bbox"]
        self.size = span["size"]
        self.origin = span["origin"]
        
    def render(self):
        return self.text
        
    def get_bbox(self):
        return self.bbox

class FractionNode(Node):
    def __init__(self, num_expr, den_expr, line_bbox):
        self.num = num_expr
        self.den = den_expr
        self.bbox = [
            min(num_expr.get_bbox()[0], den_expr.get_bbox()[0], line_bbox[0]),
            min(num_expr.get_bbox()[1], line_bbox[1]),
            max(num_expr.get_bbox()[2], den_expr.get_bbox()[2], line_bbox[2]),
            max(den_expr.get_bbox()[3], line_bbox[3])
        ]
        
    def render(self):
        return f"\\frac{{{self.num.render()}}}{{{self.den.render()}}}"
        
    def get_bbox(self):
        return self.bbox

class BracketNode(Node):
    def __init__(self, inner_expr, left_span, right_span):
        self.inner = inner_expr
        self.left_char = left_span["text"] if left_span else "["
        self.right_char = right_span["text"] if right_span else "]"
        
        inner_bbox = inner_expr.get_bbox()
        self.bbox = [
            left_span["bbox"][0] if left_span else inner_bbox[0],
            min(left_span["bbox"][1] if left_span else 9999, inner_bbox[1]),
            right_span["bbox"][2] if right_span else inner_bbox[2],
            max(right_span["bbox"][3] if right_span else 0, inner_bbox[3])
        ]
        
    def render(self):
        l = "\\left[" if "[" in self.left_char else "\\left("
        r = "\\right]" if "]" in self.right_char else "\\right)"
        return f"{l} {self.inner.render()} {r}"
        
    def get_bbox(self):
        return self.bbox

class ExpressionNode(Node):
    def __init__(self, nodes):
        # Sort nodes mathematically: Top-to-Bottom, Left-to-Right
        def get_y_group(y, tol=6): 
            return round(y/tol) * tol
            
        self.nodes = sorted(nodes, key=lambda n: (get_y_group(n.get_bbox()[1]), n.get_bbox()[0]))
        
        if not self.nodes:
            self.bbox = [0, 0, 0, 0]
        else:
            self.bbox = [
                min(n.get_bbox()[0] for n in self.nodes),
                min(n.get_bbox()[1] for n in self.nodes),
                max(n.get_bbox()[2] for n in self.nodes),
                max(n.get_bbox()[3] for n in self.nodes)
            ]
            
    def render(self):
        def get_y_group(y, tol=6): 
            return round(y/tol) * tol

        res = ""
        for i, n in enumerate(self.nodes):
            # Superscript detection
            if i > 0 and isinstance(n, TextNode) and isinstance(self.nodes[i-1], TextNode):
                prev = self.nodes[i-1]
                if n.size < prev.size * 0.9 and n.bbox[3] < prev.bbox[3] - 2:
                    res += f"^{{{n.render()}}}"
                    continue
                    
            # Add spaces or newlines based on coordinates
            if i > 0:
                prev = self.nodes[i-1]
                # Check if it's on a completely new visual line
                if get_y_group(n.get_bbox()[1]) > get_y_group(prev.get_bbox()[1]):
                    res += "\n"
                # If it's on the same line but horizontally separated
                elif n.get_bbox()[0] > prev.get_bbox()[2] + 2:
                    res += " "
                    
            res += n.render()
        return res
        
    def get_bbox(self):
        return self.bbox

# ========================================================
# LAYER 2: RECURSIVE PARSING ENGINE
# ========================================================

def get_primitive_bbox(p):
    if p["type"] == "line":
        return [p["x0"], p["y"], p["x1"], p["y"]]
    elif p["type"] == "span":
        return p["bbox"]
    elif p["type"] == "node":
        return p["bbox"]
    return [0, 0, 0, 0]

def parse_primitives(primitives) -> ExpressionNode:
    """
    Recursively turns a flat list of coordinates (lines, text) 
    into a structured mathematical AST.
    """
    if not primitives:
        return ExpressionNode([])
        
    # 1. PARSE FRACTIONS (Highest Precedence spatially)
    lines = [p for p in primitives if p.get("type") == "line"]
    if lines:
        line = lines[0] # Process one fraction at a time
        
        num_prims = []
        den_prims = []
        others = []
        
        for p in primitives:
            if p == line: continue
            
            bbox = get_primitive_bbox(p)
            cx = (bbox[0] + bbox[2]) / 2
            
            # Element is horizontally within the fraction bar
            if line["x0"] - 5 <= cx <= line["x1"] + 5:
                # MUST be vertically close (within ~40 pixels)
                if line["y"] - 40 <= bbox[3] <= line["y"] + 5:
                    num_prims.append(p)
                elif line["y"] - 5 <= bbox[1] <= line["y"] + 40:
                    den_prims.append(p)
                else:
                    others.append(p)
            else:
                others.append(p)
                
        if num_prims and den_prims:
            frac_node = FractionNode(
                num_expr=parse_primitives(num_prims),
                den_expr=parse_primitives(den_prims),
                line_bbox=[line["x0"], line["y"], line["x1"], line["y"]]
            )
            return parse_primitives(others + [{"type": "node", "node": frac_node, "bbox": frac_node.get_bbox()}])
        else:
            # Not a valid fraction, mark line as dead so we don't infinitely loop
            line["type"] = "dead_line"
            return parse_primitives(others + [line])

    # 2. PARSE BRACKETS (Containers)
    spans = [p for p in primitives if p.get("type") == "span" and not p.get("bracket_processed")]
    left_bracket = next((s for s in spans if s["text"].strip() in ["[", "("]), None)
    
    if left_bracket:
        left_bracket["bracket_processed"] = True # Prevent looping on this bracket
        ly_center = (left_bracket["bbox"][1] + left_bracket["bbox"][3]) / 2
        
        # Find matching right bracket that is on the same vertical level
        right_brackets = [
            s for s in spans 
            if s["text"].strip() in ["]", ")"] 
            and s["bbox"][0] > left_bracket["bbox"][2] 
            and abs(((s["bbox"][1] + s["bbox"][3]) / 2) - ly_center) < 25
        ]
        
        if right_brackets:
            right_bracket = right_brackets[0]
            right_bracket["bracket_processed"] = True
            
            inner_prims = []
            others = []
            
            for p in primitives:
                if p in (left_bracket, right_bracket): continue
                bbox = get_primitive_bbox(p)
                cx = (bbox[0] + bbox[2]) / 2
                cy = (bbox[1] + bbox[3]) / 2
                
                # Must be horizontally contained AND vertically aligned
                if left_bracket["bbox"][2] <= cx <= right_bracket["bbox"][0] and abs(cy - ly_center) < 35:
                    inner_prims.append(p)
                else:
                    others.append(p)
            
            if inner_prims:
                bracket_node = BracketNode(
                    inner_expr=parse_primitives(inner_prims),
                    left_span=left_bracket,
                    right_span=right_bracket
                )
                return parse_primitives(others + [{"type": "node", "node": bracket_node, "bbox": bracket_node.get_bbox()}])

        # If it failed to form a bracket, continue parsing remaining
        return parse_primitives(primitives)

    # 3. BASE CASE: Convert remaining flat primitives to an Expression
    nodes = []
    for p in primitives:
        if p.get("type") == "span":
            nodes.append(TextNode(p))
        elif p.get("type") == "node":
            nodes.append(p["node"])
            
    return ExpressionNode(nodes)

# ========================================================
# LAYER 1: DATA EXTRACTION
# ========================================================

def extract_text_with_math(page, clip=None):
    """
    Main entry point. Extracts PDF rawdict/drawings and passes them to the AST.
    """
    primitives = []
    
    # 1. Extract Vector Lines (Fraction bars)
    for d in page.get_drawings():
        for item in d["items"]:
            if item[0] == "l":
                p1, p2 = item[1], item[2]
                if abs(p1.y - p2.y) < 2 and abs(p1.x - p2.x) > 5:
                    primitives.append({"type": "line", "x0": min(p1.x, p2.x), "x1": max(p1.x, p2.x), "y": p1.y})
            elif item[0] == "re":
                rect = item[1]
                if rect.height < 3 and rect.width > 5:
                    primitives.append({"type": "line", "x0": rect.x0, "x1": rect.x1, "y": (rect.y0 + rect.y1)/2})
                    
    # Filter lines outside our layout clip
    if clip:
        primitives = [p for p in primitives if not (p["type"] == "line" and (p["x0"] < clip.x0-5 or p["x1"] > clip.x1+5 or p["y"] < clip.y0 or p["y"] > clip.y1))]
        
    # 2. Extract Text Spans
    text_dict = page.get_text("dict", clip=clip)
    for block in text_dict.get("blocks", []):
        if block.get("type") == 0:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text = span["text"].strip()
                    if text:
                        primitives.append({
                            "type": "span",
                            "text": text,
                            "bbox": span["bbox"],
                            "size": span["size"],
                            "origin": span["origin"]
                        })
                        
    # 3. Build AST and Render
    ast_root = parse_primitives(primitives)
    return ast_root.render()
