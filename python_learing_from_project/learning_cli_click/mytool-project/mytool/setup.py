# mytool/setup.py (for mytool core)
from setuptools import setup, find_packages

setup(
    name="mytool",
    version="0.1",
    packages=find_packages(),
    install_requires=["click"],
    entry_points={
        "console_scripts": [
            "mytool=mytool:main",  # 命令行入口
        ],
        "mytool.plugins": []
    },
)
