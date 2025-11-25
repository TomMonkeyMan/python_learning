# setup.py (for mytool_hello plugin)
from setuptools import setup, find_packages

#setup(
#    name="mytool-hello",
#    version="0.1",
#    packages=find_packages(),
#    install_requires=["mytool"],  # 依赖主 CLI 包
#)

setup(
    name="mytool-hello",
    version="0.1",
    #py_modules=["cli"],
    packages=find_packages(),
    install_requires=["mytool"],
    entry_points={
        "mytool.plugins": [
            "hello = mytool_hello.cli"
            ]
        },
)